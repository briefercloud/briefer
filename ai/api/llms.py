from langchain_aws import BedrockLLM
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from decouple import config

# Add available models here
bedrock_model_ids = [
    "mistral.mixtral-8x7b-instruct-v0:1",
    "amazon.titan-text-premier-v1:0",
    "anthropic.claude-3-sonnet-20240229-v1:0",
    "cohere.command-r-plus-v1:0",
]

def str_to_bool(value):
    if value is None or value == False:
        return False

    return value.lower() in ['true', '1', 't', 'y', 'yes']

def initialize_llm(model_id=None, openai_api_key=None):
    openai_api_key = openai_api_key or config("OPENAI_API_KEY")
    use_azure = config("USE_AZURE", default=False, cast=str_to_bool)


    if model_id in bedrock_model_ids:
        # Initialize Bedrock using default AWS credentials provider chain
        llm = BedrockLLM(
            model_id=model_id,
        )
    elif use_azure:
        # Initialize Azure OpenAI using the environment variables for API key and model name
        llm = AzureChatOpenAI(
            temperature=0,
            verbose=False,
            openai_api_key=openai_api_key,
            azure_endpoint=config("AZURE_OPENAI_ENDPOINT", default=""),
            azure_deployment=config("AZURE_DEPLOYMENT", default=""),
            api_version=config("AZURE_API_VERSION", default=""),
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
