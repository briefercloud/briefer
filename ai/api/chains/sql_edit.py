from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema
from langchain.output_parsers import StructuredOutputParser
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate
from langchain.chains import LLMChain
from langchain.output_parsers import OutputFixingParser

template = """You're a senior data analyst, an expert at creating queries.

Given a {dialect} query and some instructions on how to manipulate such query, perform the manipulations requested as per the instructions.

- Always try to come up with a suggestion, even if the instructions are not clear or you're not sure about the answer.
- When manipulating queries, always maintain the same LIMIT set in the original query unless the user explicitly asks for a LIMIT. If no limit is specified, do not specify one.
- You should never include formatting backticks at the start or end of the query, just return the query itself.
- When working with time, always try to return columns as DATETIME.
- If you cannot generate a query suggestion, return an empty string.

Pay attention to use only the column names that you can see in the schema description. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.

Only use the following tables:

{table_info}

Take the input query and manipulation instructions below delimited by triple backticks and use it to create a new query.

input query: ```{query}```

manipulation instructions: ```{instructions}```

{format_instructions}
"""

def create_sql_edit_query_chain(llm, db, k=5):
    sql_schema = ResponseSchema(name="sql", description="This is the generated query")
    response_schemas = [sql_schema]

    output_parser = OutputFixingParser(
        parser=StructuredOutputParser.from_response_schemas(response_schemas),
        llm=llm
    )
    format_instructions = output_parser.get_format_instructions()

    prompt = ChatPromptTemplate(
        messages=[
            HumanMessagePromptTemplate.from_template(template)
        ],
        input_variables=["query", "instructions"],
        partial_variables={
            "table_info": db.get_table_info(),
            "dialect": db.dialect,
            "top_k": k,
            "format_instructions": format_instructions
        },
    )

    return LLMChain(llm=llm, prompt=prompt, output_parser=output_parser)
