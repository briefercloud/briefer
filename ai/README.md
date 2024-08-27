```console
# create a virtual env
python3 -m venv venv

# activate the virtual env
. venv/bin/activate

# install dependencies
pip3 install --upgrade pip
pip3 install -r requirements.txt

# add a .env file like this
echo OPENAI_DEFAULT_MODEL_NAME="gpt-3.5-turbo" >> .env
echo OPENAI_API_KEY="api_key" >> .env
echo BASIC_AUTH_USERNAME="username" >> .env
echo BASIC_AUTH_PASSWORD="password" >> .env

# run the server
python3 main.py
```
