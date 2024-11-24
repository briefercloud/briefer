from langchain_community.utilities import SQLDatabase
from langchain.output_parsers.json import SimpleJsonOutputParser
from langchain.prompts import PromptTemplate
from sqlalchemy import inspect
from sqlalchemy import create_engine
from concurrent.futures import ThreadPoolExecutor

template = """You're an expert in creating queries.

Given a {dialect} query and some instructions on how to manipulate such query, perform the manipulations requested as per the instructions.

When manipulating queries, make sure it's consistent with the style of the code you see in the input query, always maintain the same LIMIT set in the original query unless the user explicitly asks for a LIMIT. If no limit is specified, do not specify one.

When input query is empty or missing, the generated query should be beautifully formatted and indented.

When working with time, always try to return columns as DATETIME.

Pay attention to use only the column names that you can see in the schema description. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.

Be aware that you can be asked to query for values that are not present in the sample data.

Only use the following tables:

{table_info}

Take the `input_query` and manipulation `instructions` below delimited by triple backticks and use it to create a new query.

input_query: ```{query}```

instructions: ```{instructions}```

Your response must contain just a JSON object with an `sql` key do not explain your thought process or the steps you took to get to the final query. The `sql` key should contain the final query you created.
"""

def get_schema_table_info(engine, schema):
    db = SQLDatabase(engine=engine, schema=schema, sample_rows_in_table_info=0)
    return db.get_table_info()


def get_catalog_table_info(catalog_engine):
    inspector = inspect(catalog_engine)
    schemas = inspector.get_schema_names()
    with ThreadPoolExecutor() as executor:
        results = executor.map(lambda schema: get_schema_table_info(catalog_engine, schema), schemas)
    return "\n\n".join(results)


def get_table_info(engine):
    table_info = ""

    if not engine:
        return table_info

    if engine.dialect.name == "trino":
        if engine.url.database:
            inspector = inspect(engine)
            schemas = inspector.get_schema_names()
            with ThreadPoolExecutor() as executor:
                results = executor.map(lambda schema: get_schema_table_info(engine, schema), schemas)
            table_info = "\n\n".join(results)
        else:
            system_catalogs = ["system", "information_schema", "current", "jmx", "memory"]
            all_catalogs = [row[0] for row in engine.execute("SHOW CATALOGS").fetchall()]
            user_catalogs = list(filter(lambda c: c not in system_catalogs, all_catalogs))
            with ThreadPoolExecutor() as executor:
                catalog_engines = [create_engine(engine.url.set(database=catalog)) for catalog in user_catalogs]
                results = executor.map(lambda ce: get_catalog_table_info(ce), catalog_engines)
            table_info = "\n\n".join(results)

    elif engine.dialect.name == "awsathena":
        inspector = inspect(engine)
        schemas = inspector.get_schema_names()
        with ThreadPoolExecutor() as executor:
            results = executor.map(lambda schema: get_schema_table_info(engine, schema), schemas)
        table_info = "\n\n".join(results)

    else:
        db = SQLDatabase(engine=engine)
        table_info = db.get_table_info()

    # truncate table_info to 100000 chars
    return table_info[:100000]


def create_sql_edit_stream_query_chain(llm, dialect, table_info):
    prompt = PromptTemplate(
        template=template,
        input_variables=["query", "instructions"],
        partial_variables={
            "table_info": table_info,
            "dialect": dialect,
        },
    )

    return prompt | llm | SimpleJsonOutputParser()
