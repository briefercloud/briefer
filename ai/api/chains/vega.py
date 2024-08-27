from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema
from langchain.output_parsers import StructuredOutputParser
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate
from langchain.chains import LLMChain
from langchain.output_parsers import OutputFixingParser

template = """Given a SQL query, create a vega lite spec to visualize the data the query returns.

The spec must be valid json, omit the "data" property.
The spec should come with a descriptive title of the chart.

Take the SQL query below delimited by triple backticks and use it to create the vega lite spec.

sql: ```{sql}```

{format_instructions}
"""

def create_vega_chain(llm):
    spec = ResponseSchema(
        name="spec", 
        type="object",
        description="This is the generated vega lite spec, omit the \"data\" property")
    response_schemas = [spec]


    output_parser = OutputFixingParser(
        parser=StructuredOutputParser.from_response_schemas(response_schemas),
        llm=llm
    )
    format_instructions = output_parser.get_format_instructions()

    prompt = ChatPromptTemplate(
        messages=[
            HumanMessagePromptTemplate.from_template(template)
        ],
        input_variables=["sql"],
        partial_variables={
            "format_instructions": format_instructions
        },
    )

    return LLMChain(llm=llm, prompt=prompt, output_parser=output_parser)
