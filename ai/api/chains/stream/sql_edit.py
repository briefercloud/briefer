from langchain.output_parsers.json import SimpleJsonOutputParser
from langchain.prompts import PromptTemplate

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
