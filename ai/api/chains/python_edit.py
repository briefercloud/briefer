from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema
from langchain.output_parsers import StructuredOutputParser
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate
from langchain.chains import LLMChain
from langchain.output_parsers import OutputFixingParser

template = """You're a senior python programmer and data scientist.

Given a source code and some instructions on how to manipulate such code, update the code as requested as per the instructions.

- When writing code, make sure it's consistent with the style of the code you see in the source code.
- Always try to come up with a code suggestion, even if the instructions are not clear or you're not sure about the answer.
- You should never include formatting backticks at the start or end of the code suggestion, just return the code suggestion itself.
- If you cannot generate a code suggestion, return an empty string.

You can only use the following libraries: {allowed_libraries}

Take the input source and manipulation instructions below delimited by triple backticks and use it to create a new source.

input source: ```{source}```

manipulation instructions: ```{instructions}```

{format_instructions}
"""

def create_python_edit_query_chain(llm):
    python_schema = ResponseSchema(name="source", description="This is the generated Python code")
    response_schemas = [python_schema]

    output_parser = OutputFixingParser.from_llm(
        parser=StructuredOutputParser.from_response_schemas(response_schemas),
        llm=llm
    )

    format_instructions = output_parser.get_format_instructions()

    prompt = ChatPromptTemplate(
        messages=[
            HumanMessagePromptTemplate.from_template(template)
        ],
        input_variables=["source", "instructions", "allowed_libraries"],
        partial_variables={ "format_instructions": format_instructions },
    )

    return LLMChain(llm=llm, prompt=prompt, output_parser=output_parser)
