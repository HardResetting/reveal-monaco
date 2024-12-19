/*
 * Monaco Editor plugin for Reveal.js
 * Version 2.0
 * by Joe Skeen
 * License: MIT
 */

let defaultOptions = {
  monacoBaseUrl: "https://cdn.jsdelivr.net/npm/monaco-editor@0.33.0",
  selector: "pre code.monaco",
  defaultLanguage: "javascript",
  debug: false,
};

export class MonacoPlugin {
  constructor(reveal) {
    this.deck = reveal;
    this.editors = new Map();
    let revealOptions = this.deck.getConfig().monaco || {};
    this.options = { ...defaultOptions, ...revealOptions };
    this.monacoBaseUrl = this.options.monacoBaseUrl;
  }

  async init() {
    await new Promise((resolve) =>
      this.loadScript(`${this.monacoBaseUrl}/min/vs/loader.js`, resolve)
    );
    require.config({ paths: { vs: `${this.monacoBaseUrl}/min/vs` } });
    await new Promise((resolve) => require(["vs/editor/editor.main"], resolve));
    if (window.monaco) {
      this.log("[monaco] loaded");
      this.monaco = window.monaco;
    } else {
      throw new Error("Could not load Monaco");
    }

    this.deck.on("slidechanged", (x) => this.onSlideChanged(x));

    // see if there is an editor on the initial slide
    this.deck.on("ready", _ => this.onSlideChanged());
  }

  loadScript(url, callback) {
    let head = document.querySelector("head");
    let script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;

    // Wrapper for callback to make sure it only fires once
    let finish = () => {
      if (typeof callback === "function") {
        callback.call();
        callback = null;
      }
    };

    script.onload = finish;

    // IE
    script.onreadystatechange = () => {
      if (this.readyState === "loaded") {
        finish();
      }
    };

    // Normal browsers
    head.appendChild(script);
  }

  onSlideChanged(event) {
    const state = {
      previousSlide: event?.previousSlide || this.deck.getPreviousSlide(),
      currentSlide: event?.currentSlide || this.deck.getCurrentSlide(),
    };
    this.log(state);

    if (state.previousSlide) {
      const codeBlocks = state.previousSlide.querySelectorAll(this.options.selector);
      codeBlocks.forEach((codeBlock, index) => {
        const editor = this.editors.get(codeBlock);
        if (editor) {
          const contents = editor.getModel().getValue().trimStart();
          editor.dispose();
          this.editors.delete(codeBlock);

          const noscript = document.createElement("script");
          noscript.setAttribute("type", "text/template");
          noscript.innerHTML = contents;
          codeBlock.appendChild(noscript);
        }
      });
    }

    if (state.currentSlide) {
      const codeBlocks = state.currentSlide.querySelectorAll(this.options.selector);
      codeBlocks.forEach((codeBlock, index) => {
        const scriptTemplateChild = codeBlock.querySelector("script[type='text/template']");
        const initialCode = (scriptTemplateChild ? scriptTemplateChild.innerHTML : codeBlock.innerHTML).trimStart();
        codeBlock.innerHTML = "";
        const language = codeBlock.getAttribute("language") || codeBlock.getAttribute("data-language") || this.options.defaultLanguage;
        monaco.editor.setTheme('vs-dark');
        const editor = this.monaco.editor.create(codeBlock, {
          ...this.options.editorOptions,
          value: initialCode,
          language: language
        });

        editor.getModel().onDidChangeContent(e => {
          const contentChangeEvent = new CustomEvent("reveal-monaco-content-change", { bubbles: true, detail: { textContent: editor.getModel().getValue() } });
          codeBlock.dispatchEvent(contentChangeEvent);
        });

        // Store the editor instance
        this.editors.set(codeBlock, editor);

        // Dispatch event for initial display of the editor
        codeBlock.dispatchEvent(new CustomEvent("reveal-monaco-content-change", { bubbles: true, detail: { textContent: editor.getModel().getValue() } }));
      });
    }
  }

  log(content) {
    if (this.options.debug) {
      console.info(content);
    }
  }
}

export const Plugin = () => {
  return {
    id: "monaco",

    init: function (reveal) {
      const plugin = new MonacoPlugin(reveal);
      return plugin.init();
    },
  };
};

export default Plugin;
