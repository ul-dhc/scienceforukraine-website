window.escapeHtml = function (str) {
  var div = document.createElement('div')
  div.textContent = str == null ? '' : String(str)
  return div.innerHTML
}
