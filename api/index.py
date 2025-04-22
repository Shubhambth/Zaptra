from flask import Flask, render_template
from flask import send_from_directory

app = Flask(__name__, template_folder="../templates", static_folder="../static")

@app.route("/")
def index():
    return render_template("index.html")

# Required for Vercel to run Flask in serverless function mode
def handler(request):
    with app.request_context(request.environ):
        return app.full_dispatch_request()
