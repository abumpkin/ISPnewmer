const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const utils = require("./utils");

let htmlVars = {
  resPath: null,
};

function WebviewProvider(ctx) {
  this.resolveWebviewView = function (webviewView, context, token) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [ctx.extensionUri],
    };
    // utils.logobj(ctx)
    let html = String(
      fs.readFileSync(
        path.join(ctx.extensionPath, "src", "panel", "panel.html")
      )
    );
    for (let i in htmlVars) {
      html = html.replaceAll(
        `\$\{${i}\}`,
        webviewView.webview.asWebviewUri(htmlVars[i])
      );
    }
    webviewView.webview.html = html;
  };
}

exports.activate = function (context) {
  htmlVars.resPath = context.extensionUri;
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "isp",
      new WebviewProvider(context)
    )
  );
};

exports.deactivate = function () {};
