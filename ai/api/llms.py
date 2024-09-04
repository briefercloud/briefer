from langchain_aws import BedrockLLM
from langchain_openai import ChatOpenAI
from decouple import config

# Add available models here
bedrock_model_ids = [
    "mistral.mixtral-8x7b-instruct-v0:1",
    "amazon.titan-text-premier-v1:0",
    "anthropic.claude-3-sonnet-20240229-v1:0",
    "cohere.command-r-plus-v1:0",
]

def initialize_llm(model_id=None, openai_api_key=None):
    openai_api_key = openai_api_key or config("OPENAI_API_KEY")

    if model_id in bedrock_model_ids:
        # Initialize Bedrock using default AWS credentials provider chain
        llm = BedrockLLM(
            model_id=model_id,
        )
    else:
        # Initialize OpenAI using environment variables for API key and model name
        llm = ChatOpenAI(
            temperature=0,
            verbose=False,
            openai_api_key=openai_api_key,
            model_name=model_id if model_id else config("OPENAI_DEFAULT_MODEL_NAME"),
        )
    return llm
