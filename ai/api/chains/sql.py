from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema
from langchain.output_parsers import StructuredOutputParser
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate
from langchain.chains import LLMChain
from langchain.output_parsers import OutputFixingParser

template = """Given an input question, first create a syntactically correct {dialect} query, then return the query the reasoning behind it. The reasoning should be more high level, don't explain SQL syntax but mention tables, columns and relations. Unless the user specifies in his question a specific number of examples he wishes to obtain, always limit your query to at most {top_k} results using the LIMIT clause. You can order the results by a relevant column to return the most interesting examples in the database.

When working with time, always try to return columns as DATETIME.

Never query for all the columns from a specific table, only ask for a the few relevant columns given the question.

Pay attention to use only the column names that you can see in the schema description. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.

Only use the following tables:

{table_info}

Take the input question below delimited by triple backticks and use it to create the query and reasoning.

input question: ```{question}```

{format_instructions}
"""

def create_sql_query_chain(llm, db, k=5):
    question_schema = ResponseSchema(name="question", description="This is the input question")
    sql_schema = ResponseSchema(name="sql", description="This is the generated query")
    reasoning_schema = ResponseSchema(
        name="reasoning", type="array",
        description="This is the trail of thought that lead to the generated query, usually 3 to 4 steps")
    response_schemas = [question_schema, sql_schema, reasoning_schema]

    output_parser = OutputFixingParser.from_llm(
        parser = StructuredOutputParser.from_response_schemas(response_schemas),
        llm=llm
    )
    format_instructions = output_parser.get_format_instructions()

    prompt = ChatPromptTemplate(
        messages=[
            HumanMessagePromptTemplate.from_template(template)
        ],
        input_variables=["question"],
        partial_variables={
            "table_info": db.get_table_info(),
            "dialect": db.dialect,
            "top_k": k,
            "format_instructions": format_instructions
        },
    )

    return LLMChain(llm=llm, prompt=prompt, output_parser=output_parser)
