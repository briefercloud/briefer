from langchain.output_parsers.json import SimpleJsonOutputParser
from langchain.prompts import PromptTemplate

template = """You're a senior python programmer and data scientist.

Given a source code and some instructions on how to manipulate such code, update the code as requested as per the instructions.

When writing code, make sure it's consistent with the style of the code you see in the source code, preferring the indenting there. If the source code is empty or missing, you should write the code from scratch and indent it beautifully.

You can only use the following libraries: {allowed_libraries}

Take the `input_source` and the manipulation `instructions` below delimited by triple backticks and use them to create the result source.

If necessary, you can use the already existing `global_variables`. Assume these `global_variables` already exist in the context and avoid redefining them, as if you were using the python block of a jupyter notebook.

input_source: ```{source}```

global_variables: ```{variables}```

instructions: ```{instructions}```

Your response must contain just a JSON object with an `source` key.
"""

def create_python_edit_stream_query_chain(llm):
    prompt = PromptTemplate(
        template=template,
        input_variables=["allowed_libraries", "source", "instructions", "variables"]
    )
    return prompt | llm | SimpleJsonOutputParser()
