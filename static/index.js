var sel = {
  file: 'input[name=image]',
  fileB64: 'input[name=imageB64]',
  fileB64Name: '.imageB64Name',
  preview: '.imagepreview',
  previewImg: '.imagepreview > img',
  previewName: '.imagepreview-filename',
  submit: 'input[type=submit]',
  output: 'output'
};

function $(selector) {
  return document.querySelector(selector);
}

function showPreview(file, name) {
  var url = (typeof file === 'object') ? URL.createObjectURL(file) : file;
  $(sel.previewImg).src = url;
  $(sel.previewName).textContent = (name || file.name);
  $(sel.file).hidden = true;
  $(sel.preview).hidden = false;
}

function fileInputChanged(el) {
  var file = el.files[0];
  if (file) {
    $(sel.fileB64).value = '';
    showPreview(file);
  } else {
    clearFile();
  }
}

function replaceFileInput() {
  var input = $(sel.file);
  var template = document.createElement('span');
  template.innerHTML = input.outerHTML;
  var input2 = template.firstChild;
  input.parentNode.replaceChild(input2, input);
  return input2;
}

function clearFile() {
  var input2 = replaceFileInput();
  $(sel.fileB64).value = '';
  $(sel.preview).hidden = true;
  input2.hidden = false;
}

function setFile(file, name) {
  var reader = new FileReader();
  reader.onload = function() {
    replaceFileInput();
    $(sel.fileB64).value = reader.result;
    $(sel.fileB64Name).value = (name || file.name);
    showPreview(file, name);
  };
  reader.readAsDataURL(file);
}

document.ondragover = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
};

document.ondrop = function(e) {
  if (e.target.nodeName === 'INPUT') return;
  var file = e.dataTransfer.files[0];
  if (!file) return;
  e.preventDefault();
  setFile(file);
};

document.onpaste = function(e) {
  if (!e.clipboardData.items) return;
  var item = e.clipboardData.items[0];
  if (!(item && item.kind === 'file')) return;
  var file = e.clipboardData.items[0].getAsFile();
  var name = (file.name || 'Pasted Image');
  setFile(file, name);
};

function parseHash() {
  var inputs = document.querySelectorAll('input[type=text], input[type=hidden], select');
  var i;
  var names = [];
  var namedInputs = [];
  for (i = 0; i < inputs.length; i++) {
    names.push(inputs[i].name);
    namedInputs.push(inputs[i]);
  }
  var hashParts = location.hash.replace(/^#/, '').split('&');
  for (i = 0; i < hashParts.length; i++) {
    var keyVal = hashParts[i].split('=');
    if (keyVal.length === 2) {
      var j = names.indexOf(keyVal[0]);
      if (j >= 0) {
        namedInputs[j].value = decodeURIComponent(keyVal[1]);
      }
    }
  }
}

function initPreview() {
  var file;
  if ((file = $(sel.file).files[0])) {
    showPreview(file);
  } else if ((file = $(sel.fileB64).value)) {
    var name = $(sel.fileB64Name).value;
    showPreview(file, name);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  parseHash();
  initPreview();
});
