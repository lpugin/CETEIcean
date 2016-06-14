import behaviors from './behaviors'
class CETEI {

    constructor(base){
        this.els = [];
        this.behaviors = [];
        this.hasStyle = false;
        if (base) {
          this.base = base;
        } else {
          this.base = window.location.href.replace(/\/[^\/]*$/, "/");
        }
        let methods = Object.getOwnPropertyNames(CETEI.prototype);
        this.behaviors.push(behaviors);
    }

    // public method
    getHTML5(TEI_url, callback){
        // Get TEI from TEI_url and create a promise
        let promise = new Promise( function (resolve, reject) {
            let client = new XMLHttpRequest();

            client.open('GET', TEI_url);
            client.send();

            client.onload = function () {
              if (this.status >= 200 && this.status < 300) {
                resolve(this.response);
              } else {
                reject(this.statusText);
              }
            };
            client.onerror = function () {
              reject(this.statusText);
            };
        })
        .then((TEI) => {
            this.makeHTML5(TEI, callback);
        })
        .catch( function(reason) {
            // TODO: better error handling?
            console.log(reason);
        });

        return promise;

    }

    makeHTML5(TEI, callback){
      // TEI is assumed to be a string
      let TEI_dom = ( new window.DOMParser() ).parseFromString(TEI, "text/xml");

      this._fromTEI(TEI_dom);

      let convertEl = (el) => {
          // Create new element
          let newElement = document.createElement('tei-' + el.tagName);
          // Copy attributes; @xmlns, @xml:id, @xml:lang, and
          // @rendition get special handling.
          for (let att of Array.from(el.attributes)) {
              if (att.name != "xmlns") {
                newElement.setAttribute(att.name, att.value);
              } else {
                newElement.setAttribute("data-xmlns", att.value); //Strip default namespaces, but hang on to the values
              }
              if (att.name == "xml:id") {
                newElement.setAttribute("id", att.value);
              }
              if (att.name == "xml:lang") {
                newElement.setAttribute("lang", att.value);
              }
              if (att.name == "rendition") {
                newElement.setAttribute("class", att.value.replace(/#/g, ""));
              }
          }
          for (let node of Array.from(el.childNodes)){
              if (node.nodeType == Node.ELEMENT_NODE) {
                  newElement.appendChild(  convertEl(node)  );
              }
              else {
                  newElement.appendChild(node.cloneNode());
              }
          }
          // Turn <rendition scheme="css"> elements into HTML styles
          if (el.localName == "tagsDecl") {
            let style = document.createElement("style");
            for (let node of Array.from(el.childNodes)){
              if (node.nodeType == Node.ELEMENT_NODE && node.localName == "rendition" && node.getAttribute("scheme") == "css") {
                let rule = "";
                if (node.hasAttribute("selector")) {
                  //rewrite element names in selectors
                  rule += node.getAttribute("selector").replace(/([^#, >]+\w*)/g, "tei-$1").replace(/#tei-/g, "#") + "{\n";
                  rule += node.textContent;
                } else {
                  rule += "." + node.getAttribute("xml:id") + "{\n";
                  rule += node.textContent;
                }
                rule += "\n}\n";
                style.appendChild(document.createTextNode(rule));
              }
            }
            if (style.childNodes.length > 0) {
              newElement.appendChild(style);
              this.hasStyle = true;
            }
          }
          return newElement;
      }

      this.dom = convertEl(TEI_dom.documentElement);

      if (document.registerElement) {
        this.registerAll(this.els);
      } else {
        this.fallback(this.els);
      }

      if (callback) {
          callback(this.dom);
      }
      else {
          return this.dom;
      }
    }

    addStyle(doc, data) {
      if (this.hasStyle) {
        doc.getElementsByTagName("head").item(0).appendChild(data.getElementsByTagName("style").item(0).cloneNode(true));
      }
    }

    // public method
    addBehaviors(bhvs){
      if (bhvs["handlers"] || bhvs ["fallbacks"]) {
        this.behaviors.push(bhvs);
      } else {
        console.log("No handlers or fallback methods found.");
      }
    }

    decorator(fn, strings) {
      return function() {
        let elts = this.dom.getElementsByTagName("tei-" + fn);
        for (let i = 0; i < elts.length; i++) {
          let elt = elts[i];
          let span = document.createElement("span");
          span.innerHTML = strings[0];
          elt.insertAdjacentElement("afterbegin",span);
          if (strings.length > 1) {
            span = document.createElement("span"),
            span.innerHTML = strings[1];
            elt.insertAdjacentElement("beforeend",span);
          }
        }
      }
    }

    getHandler(fn) {
      for (let b of this.behaviors.reverse()) {
        if (b["handlers"][fn]) {
          if (Array.isArray(b["handlers"][fn])) {
            return this.decorator(fn, b["handlers"][fn]);
          } else {
            return b["handlers"][fn];
          }
        }
      }
    }

    getFallback(fn) {
      for (let b of this.behaviors.reverse()) {
        if (b["fallbacks"][fn]) {
          if (Array.isArray(b["fallbacks"][fn])) {
            return this.decorator(fn, b["fallbacks"][fn]);
          } else {
            return b["fallbacks"][fn];
          }
        } else if (b["handlers"][fn] && Array.isArray(b["handlers"][fn])) {
          return this.decorator(fn, b["handlers"][fn]);
        }
      }
    }

    registerAll(names) {
      for (let name of names) {
        let proto = Object.create(HTMLElement.prototype);
        let fn = this.getHandler(name);
        if (fn) {
          fn.call(this, proto);
        }
        // Make sure element isn't already registered
        let prefixedName = "tei-" + name;
        if (document.createElement(prefixedName).constructor !== HTMLElement) {
          document.registerElement(prefixedName, {prototype: proto});
        }
      }
    }

    fallback(names) {
      for (let name of names) {
        let fn = this.getFallback(name);
        if (fn) {
          fn.call(this);
        }
      }
    }

    setBaseUrl(base) {
      this.base = base;
    }

    rewriteRelativeUrl(url) {
      if (!url.match(/^(?:http|mailto|file|\/).*$/)) {
        return this.base + url;
      } else {
        return url;
      }
    }

    // public method
    fromODD(){
        // Place holder for ODD-driven setup.
        // For example:
        // Create table of elements from ODD
        //    * default HTML behaviour mapping on/off (eg tei:div to html:div)
        //    ** phrase level elements behave like span (can I tell this from ODD classes?)
        //    * optional custom behaviour mapping
    }

    // "private" method
    _fromTEI(TEI_dom) {
        let root_el = TEI_dom.documentElement;
        this.els = new Set( Array.from(root_el.getElementsByTagName("*"), x => x.tagName) );
        this.els.add(root_el.tagName); // Add the root element to the array
    }

}

// Make main class available to pre-ES6 browser environments
if (window) {
    window.CETEI = CETEI;
}
export default CETEI;
