const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const utils = require("./utils");

function WebviewProvider(ctx) {
  this.resolveWebviewView = function (webviewView, context, token) {
    webviewView.webview.options = {
      enableScripts: true,
      //   localResourceRoots: [ctx.extensionUri],
    };
    // utils.logobj(ctx)
    webviewView.webview.html = String(
      fs.readFileSync(path.join(ctx.extensionPath, "src", "panel.html"))
    );
  };
}

exports.activate = function (context) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "isp",
      new WebviewProvider(context)
    )
  );
};

exports.deactivate = function () {};
