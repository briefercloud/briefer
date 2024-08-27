# from langchain.globals import set_debug
# set_debug(True)
# from langchain.globals import set_verbose
# set_verbose(True)

import tempfile
import json
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from langchain_community.utilities import SQLDatabase
from langchain_openai import ChatOpenAI
from decouple import config
from api.chains.sql import create_sql_query_chain
from api.llms import initialize_llm
from api.chains.sql_edit import create_sql_edit_query_chain
from api.chains.python_edit import create_python_edit_query_chain
from api.chains.stream.python_edit import create_python_edit_stream_query_chain
from api.chains.stream.sql_edit import create_sql_edit_stream_query_chain
from api.chains.vega import create_vega_chain
import secrets
from sqlalchemy.engine import create_engine
from typing import Any

def get_database_engine(databaseURL: str, credentialsInfo: Any, cert_path: str | None = None):
    connect_args = {}
    if cert_path:
        connect_args["sslmode"] = "verify-ca"
        connect_args["sslrootcert"] = cert_path

    if credentialsInfo:
        engine = create_engine(databaseURL, credentials_info=credentialsInfo, connect_args=connect_args)
    else:
        engine = create_engine(databaseURL, connect_args=connect_args)

    return engine

app = FastAPI()

security = HTTPBasic()

def get_current_username(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, config("BASIC_AUTH_USERNAME"))
    correct_password = secrets.compare_digest(credentials.password, config("BASIC_AUTH_PASSWORD"))
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

class SQLInputData(BaseModel):
    credentialsInfo: Any
    databaseURL: str
    question: str
    modelId: Optional[str] = None

@app.post("/v1/sql")
async def v1_sql(data: SQLInputData, _ = Depends(get_current_username)):
    engine = get_database_engine(data.databaseURL, data.credentialsInfo)
    db = SQLDatabase(engine=engine)

    llm = initialize_llm(model_id=data.modelId)
    chain = create_sql_query_chain(llm, db)
    res = chain.invoke({"question": data.question})

    return res["text"]


class VegaInputData(BaseModel):
    sql: str
    model_id: Optional[str] = None

@app.post("/v1/vega")
async def v1_vega(data: VegaInputData, _ = Depends(get_current_username)):
    llm = initialize_llm(model_id=data.modelId)
    chain = create_vega_chain(llm)
    res = chain.invoke({"sql": data.sql})

    return res["text"]

class SQLEditInputData(BaseModel):
    databaseURL: str
    credentialsInfo: Any
    query: str
    instructions: str
    modelId: Optional[str] = None

@app.post("/v1/sql/edit")
async def v1_sql_edit(data: SQLEditInputData, _ = Depends(get_current_username)):
    engine = get_database_engine(data.databaseURL, data.credentialsInfo)
    db = SQLDatabase(engine=engine)

    llm = initialize_llm(model_id=data.modelId)
    chain = create_sql_edit_query_chain(llm, db)
    res = chain.invoke({"query": data.query, "instructions": data.instructions})

    return res["text"]

class PythonEditInputData(BaseModel):
    source: str
    instructions: str
    allowedLibraries: List[str]
    variables: str
    modelId: Optional[str] = None

@app.post("/v1/python/edit")
async def v1_python_edit(data: PythonEditInputData, _ = Depends(get_current_username)):
    llm = initialize_llm(model_id=data.modelId)
    chain = create_python_edit_query_chain(llm)
    res = chain.invoke({"source": data.source, "instructions": data.instructions, "allowed_libraries": data.allowedLibraries})

    return res["text"]

@app.post("/v1/stream/sql/edit")
async def v1_steam_sql_edit(data: SQLEditInputData, _ = Depends(get_current_username)):
    with tempfile.NamedTemporaryFile(delete=True) as temp_cert_file:
        credentialsInfo = data.credentialsInfo
        cert_temp_file_path = None
        if data.credentialsInfo and "sslrootcert" in data.credentialsInfo:
            certdata = bytes.fromhex(data.credentialsInfo["sslrootcert"])
            temp_cert_file.write(certdata)
            temp_cert_file.flush()
            cert_temp_file_path = temp_cert_file.name
            credentialsInfo = None

        engine = None
        if data.databaseURL != "duckdb":
            engine = get_database_engine(data.databaseURL, credentialsInfo, cert_temp_file_path)
        llm = initialize_llm(model_id=data.modelId)
        chain = create_sql_edit_stream_query_chain(llm, engine)

        async def generate():
            async for result in chain.astream({"query": data.query, "instructions": data.instructions}):
                yield json.dumps(result) + "\n"

        return StreamingResponse(generate(), media_type="text/plain")

@app.post("/v1/stream/python/edit")
async def v1_stream_python_edit(data: PythonEditInputData, _ = Depends(get_current_username)):
    llm = initialize_llm(model_id=data.modelId)
    chain = create_python_edit_stream_query_chain(llm)

    async def generate():
        stream = chain.astream({
            "source": data.source,
            "instructions": data.instructions,
            "allowed_libraries": data.allowedLibraries,
            "variables": data.variables
        })
        async for result in stream:
            yield json.dumps(result) + "\n"

    return StreamingResponse(generate(), media_type="text/plain")

@app.get("/ping")
async def ping():
    return "pong"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
