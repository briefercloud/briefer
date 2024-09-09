from .briefer_handler import setup_handlers

def _jupyter_server_extension_points():
    return [{
        "module": "jupyter_briefer_extension",
    }]

def _load_jupyter_server_extension(nbapp):
    setup_handlers(nbapp.web_app)
    nbapp.log.info("Jupyter Briefer Extension loaded.")
