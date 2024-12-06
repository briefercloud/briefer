# from langchain.globals import set_debug
# set_debug(True)
# from langchain.globals import set_verbose
# set_verbose(True)

import json
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from decouple import config
from api.llms import initialize_llm
from api.chains.stream.python_edit import create_python_edit_stream_query_chain
from api.chains.stream.sql_edit import create_sql_edit_stream_query_chain
import secrets


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


class SQLEditInputData(BaseModel):
    query: str
    instructions: str
    dialect: str
    tableInfo: Optional[str] = None
    modelId: Optional[str] = None
    openaiApiKey: Optional[str] = None

@app.post("/v1/stream/sql/edit")
async def v1_steam_sql_edit(data: SQLEditInputData, _ = Depends(get_current_username)):
    llm = initialize_llm(model_id=data.modelId, openai_api_key=data.openaiApiKey)
    chain = create_sql_edit_stream_query_chain(llm, data.dialect, data.tableInfo)

    async def generate():
        async for result in chain.astream({"query": data.query, "instructions": data.instructions}):
            yield json.dumps(result) + "\n"

    return StreamingResponse(generate(), media_type="text/plain")

class PythonEditInputData(BaseModel):
    source: str
    instructions: str
    allowedLibraries: List[str]
    variables: str
    modelId: Optional[str] = None
    openaiApiKey: Optional[str] = None


@app.post("/v1/stream/python/edit")
async def v1_stream_python_edit(data: PythonEditInputData, _ = Depends(get_current_username)):
    llm = initialize_llm(model_id=data.modelId, openai_api_key=data.openaiApiKey)
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
