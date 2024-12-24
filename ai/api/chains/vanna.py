from vanna.openai.openai_chat import OpenAI_Chat
from vanna.chromadb.chromadb_vector import ChromaDB_VectorStore
from decouple import config

class MyVanna(ChromaDB_VectorStore, OpenAI_Chat):
    def __init__(self, config=None):
        ChromaDB_VectorStore.__init__(self, config=config)
        OpenAI_Chat.__init__(self, config=config)

def create_vanna(api_key, model, table_info):
    api_key = api_key or config("OPENAI_API_KEY")
    model = model if model else config("OPENAI_DEFAULT_MODEL_NAME")

    vn = MyVanna(config={"api_key": api_key, "model": model, "n_results": 100, "client": "in-memory"})
    tables = table_info.split("\n\n")

    for table in tables[:250]:
        vn.train(ddl=table)

    return vn
