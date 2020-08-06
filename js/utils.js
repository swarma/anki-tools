// 正则替换函数（替换所有）
function regexReplG(orig_str, regex_str, subst_str) {
  const regex = new RegExp(regex_str, 'g');
  return orig_str.replace(regex, subst_str);
}
// 正则替换函数（替换一处）
function regexRepl(orig_str, regex_str, subst_str) {
  const regex = new RegExp(regex_str);
  return orig_str.replace(regex, subst_str);
}
// 同步设置 TEXTAREA 编辑框内容
function setNativeValue(element, value) {
  const { set: valueSetter } = Object.getOwnPropertyDescriptor(element, 'value') || {}
  const prototype = Object.getPrototypeOf(element);
  const { set: prototypeValueSetter } = Object.getOwnPropertyDescriptor(prototype, 'value') || {}

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    throw new Error('指定的元素没有 setter.');
  }
}
// 把指定内容写入 TEXTAREA
function fillTextArea(textarea_id, contents) {
  var element = document.getElementById(textarea_id);
  setNativeValue(element, contents);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
// 读取本地文件内容并做处理
function readLocalFile(e) {
  var file = e.target.files[0];
  var textarea_id = e.target.textarea_id;
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var opml_text = e.target.result;
    var escaped_opml_text = opmlTextEscape(opml_text);
    var json_obj = OPML2JSON(escaped_opml_text);
    var markdown_str = JSON2Markdown(json_obj);
    // 读取出文件内容立即写入 TEXTAREA 区域
    fillTextArea(textarea_id, markdown_str);
  };
  reader.readAsText(file);
}
// 对多行文本内容的预处理动作
function preProcess(text) {
  var res_str = text;
  res_str = regexReplG(res_str.trim(), '&nbsp;', ' ');
  res_str = regexReplG(res_str.trim(), '^[\r\n]+', '');
  res_str = regexReplG(res_str.trim(), '[\r\n]+$', '');
  res_str = regexReplG(res_str.trim(), '[\r\n]+', '\n');
  return res_str;
}
function roamPreProcess(text) {
  let lines = preProcess(text).split("\n");
  let regex = /^( *)-(.*)$/i;
  for (idx in lines) {
    let res = regex.exec(lines[idx]);
    if (res == null) { alert("请仔细检查这一行的格式：\n\n【" + lines[idx].trim() + "】"); }
    str_before_dash = res[1];
    str_after_dash = res[2];
    str_after_dash = regexReplG(str_after_dash.trim(), '^"(.*)"$', ' <u>$1</u>');
    tab_cnt = str_before_dash.length / 4 + 1;
    lines[idx] = "#".repeat(tab_cnt) + str_after_dash;
  }
  return lines.join("\n");
}
// 对文本内容中的 > < 等符号做编码处理
function encodeHTML(text) {
  var textarea = document.createElement("textarea");
  textarea.textContent = text;
  return textarea.innerHTML;
}
// 对文本内容中的 &gt; &lt; 等符号做解码处理
function decodeHTML(html) {
  var textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
}
// 移除大纲文本内容中已有的超链接（针对 mubu.io）
function remove_html_link_tag(text) {
  var res_str = text;
  res_str = regexReplG(res_str.trim(), '<a class="content-link"[^>]+>([^<]+)</a>', '$1');
  return res_str;
}
// 把 opml 中的 text 属性改名为 pimgeek_text（针对 mubu.io）
function opmlTextEscape(opml_text) {
  const regex = '<outline text="([^"]+)"';
  var res = opml_text.match(regex);
  while(res) {
    subst = encodeHTML(res[1]);
    opml_text = regexRepl(opml_text.trim(), regex, '<outline pimgeek_text="' + subst + '"');
    res = opml_text.match(regex);
  }
  opml_text = regexReplG(opml_text, '<outline pimgeek_text=', '<outline text=');
  return opml_text;
}
// 获取单行 Markdown 文本的标题和级别
function getTitleAndLevel(markdown_line) {
	const level_regex = new RegExp("^#+");
	var matches = level_regex.exec(markdown_line);
  if (matches) {
	  var level = matches[0].length;
	  var title = markdown_line.replace(matches[0], '').trim();
	  return { 'title': title, 'level': level };
  } else {
    return { 'title': markdown_line, 'level': 0 };
  }
}
// 把 Markdown 标题序列转换为 LeveledObj 对象以便做后续处理
function text2LeveledObj(markdown_lines) {
  var clean_markdown_lines = preProcess(markdown_lines);
  if (clean_markdown_lines.startsWith("-")) {
    clean_markdown_lines = roamPreProcess(clean_markdown_lines);
  }
  var lines = clean_markdown_lines.split("\n");  
  var leveled_obj = [];
  for (var line_id in lines) {
    var title_n_level = getTitleAndLevel(lines[line_id]);
    var title = title_n_level.title;
    var level = title_n_level.level;
    leveled_obj[line_id] = { 'line_id': line_id, 'title': title, 'level': level, 'children': [] };
    var parent_line_id = findParent(leveled_obj, line_id);
    if (parent_line_id !== -1) {
        leveled_obj[parent_line_id].children.push(line_id);
    }
  }
  return leveled_obj;
}
function postTraverse(leveled_obj, root_line_id) {
  var new_leveled_obj = []
  if (!leveled_obj || leveled_obj.length == 0) {
    return leveled_obj;
  }
  var root = leveled_obj[root_line_id];
  for (var child_line_id of root.children.reverse()) {
    var child = leveled_obj[child_line_id];
    if (child.children.length == 0) {
      new_leveled_obj.push(child);
    }
    else {
      new_leveled_obj = postTraverse(leveled_obj, child.line_id).concat(new_leveled_obj);
    }
  }
  new_leveled_obj.push(root);
  return new_leveled_obj;
}
// 把 OPML 字符串转换为 JSON 对象以便做后续处理
function OPML2JSON(opml) {
  var x2j = new X2JS();
  var json_obj = x2j.xml_str2json(opml);
  return json_obj;
}
// 把 JSON 对象转换为 Markdown 以便做后续处理
function JSON2Markdown(json_obj) {
  var root_item = json_obj.opml.body.outline;
  var markdown_str = convItemToMarkdownArrayByLevel(root_item, 12).join('\n');
  return markdown_str;
}
// 解析幕布专用图片格式
function imgParse(text) {
  unescaped_text = unescape(text);
  res_str = regexReplG(unescaped_text.trim(), '.*:"(.+\.jpg)".+$', '!\[.\]\(https://mubu.com/$1\)');
  return res_str;
}
// 获取指定大纲条目的标题
function getItemTitle(item){
  res_str = ''
  if (typeof(item) !== 'undefined') {
    res_str = decodeHTML(item["_text"]);
    is_md = res_str.search(/!\[[^\]]*\]\([^\)]*\)/g);
    if ('__mubu_text' in item && is_md == -1) {
      res_str = remove_html_link_tag(decodeHTML(decodeURI(item['__mubu_text'])));
    }
    if ('__images' in item) {
      res_str += imgParse(item['__images']);
    }
    if ('__transno_images' in item) {
      res_str += imgParse(item['__transno_images']);
    }
  }
  return res_str;
}
// 获取指定大纲条目的笔记
function getItemNote(item){
  if (typeof(item) !== 'undefined' && '__note' in item) {
    return item["__note"];
  }
  else {
    return "";
  }
}
// 获取指定大纲条目的内部条目序列
function getInsideItems(item){
  if (typeof(item) === 'undefined' || typeof(item["outline"]) === 'undefined' || ('__complete' in item && item['__complete'] === 'true')) {
    return [];
  } else if (Array.isArray(item['outline'])) {
    return item['outline'];
  } else if ((item['outline']).constructor === Object) {
    return [item['outline']];
  } else {
    return [];
  }
}
// 把给定的对象逐级转换为 Markdown 文本
function convItemToMarkdownArrayByLevel(item, level) {
  var md_array = [];
  var sub_md_array = [];
  if (item === 'undefined' ||('__complete' in item && item['__complete'] === 'true')) {
    return []; // 妥善处理边界条件，避免出现异常
  }
  else if (level < 0 || level > 50) {
    console.log("level 数值超出范围（0-50）！");
    return [];
  } 
  else {
    md_array.push("# " + getItemTitle(item));
    const sub_item_array = getInsideItems(item);
    if (level === 0 || typeof(sub_item_array) === 'undefined') {
      sub_md_array = [];
    } 
    else {
      var item_idx;
      for (item_idx in sub_item_array) {
        sub_md_array = sub_md_array.concat(
          convItemToMarkdownArrayByLevel(sub_item_array[item_idx], level - 1));
      }
    }
    md_array = md_array.concat(sub_md_array.map(
      function (str) { 
        if (str !== 'undefined' && str.startsWith('#')) {
          return "#" + str;
        }
        else {
          return str;
        }
      }));
  }
  return md_array;
}
// 对单行内容做 Markdown 语法解析, 并转换为 HTML 格式
function markdown2HTML(input_str) {
  let output_str = "";
  output_str = regexReplG(input_str, '\\[\\[([^\\]]+)\\]\\]', '<span class="page">$1</span>');
  output_str = regexReplG(output_str, '\\*{2}([^\\*]+)\\*{2}', '<span class="bold">$1</span>');
  output_str = regexReplG(output_str, '_{2}([^_]+)_{2}', '<span class="italic">$1</span>');
  output_str = regexReplG(output_str, '\\^{2}([^\\^]+)\\^{2}', '<span class="highlight">$1</span>');
  output_str = regexReplG(output_str, '\\*([^\\*]+)\\*', '<span class="italic">$1</span>');
  output_str = regexReplG(output_str, '\\!\\[[^\\[]*\\]\\(([^\(\)]*)\\)', '<img src="$1" />');
  output_str = regexReplG(output_str, '\\[([^\\[]*)\\]\\(([^\(\)]*)\\)', '<a href="$2">$1</a>');
  output_str = regexReplG(output_str, '<span>([^<]*)<\/span>', '$1');
  return output_str;
}
// 从给定的 LeveledObj 中获取某行的大纲标题
function getLineTitle(leveled_obj, line_id) {
  let line_title = "";
  if (line_id < leveled_obj.length) {
    line_title = leveled_obj[line_id].title;
  }
  return line_title;
}

// 从给定的 LeveledObj 中查找某级别的上级节点
// 并返回其节点 id
// (注意是按照从下往上的顺序查找, 找到第一个就停止寻找)
function findParent(leveled_obj, child_line_id) {
  let parent_line_id = -1;
  let child = leveled_obj[child_line_id];
  for (let line_id = child_line_id - 1; line_id >= 0; line_id--) {
    if (typeof(child) != "undefined" && leveled_obj[line_id].level == child.level - 1) {
      parent_line_id = line_id;
      break;
    }
  }
  return parent_line_id;
}
// 从大纲中抽取章节信息
// --------
// 获取某项内容在给定的 Outline 中的 XPath
// 形如 标题1-标题1.1-标题1.1.1
function getXPathInOutline(leveled_obj, item) {
  var xpath = [];
  var parent_title = "";
  if (item.level == 1) {
    return "";
  } else if (item.level == 2) {
    var parent_line_id = findParent(leveled_obj, item.line_id);
    if (parent_line_id != -1) {
      parent_title = leveled_obj[parent_line_id].title;
      parent_title = parent_title.replace('-','·');
      return html2text(markdown2HTML(parent_title));
    }
  } else if (item.level >= 3) {
    var parent_line_id = findParent(leveled_obj, item.line_id);
    if (parent_line_id != -1) {
      parent_title = leveled_obj[parent_line_id].title;
      parent_title = parent_title.replace('-','·');
    }
    while (parent_line_id >= 0) {
      xpath.unshift(html2text(markdown2HTML(parent_title)));
      parent_line_id = findParent(leveled_obj, parent_line_id);
      if (parent_line_id != -1) {
        parent_title = leveled_obj[parent_line_id].title;
        parent_title = parent_title.replace('-','·');
      }
    }
    return xpath.join('-');
  }
}

function getNthLevelXPath(xpath, num) {
  var nth_level_xpath = "";
  var tmp_list = xpath.split('-').slice(0, num);
  nth_level_xpath = tmp_list.join('-');
  return nth_level_xpath;
}

function getAnkiChapterInfo(item, xpath) {
  var anki_chap_info = "";
  var item_title = item.title.replace('-','·');
  if (item.level == 1) {
    anki_chap_info = '《' + html2text(markdown2HTML(item_title)) + '》';
  }	else if (item.level == 2) {
    anki_chap_info = '《' + xpath + '-' + html2text(markdown2HTML(item_title)) + '》';
  } else {
    anki_chap_info = '《' + getNthLevelXPath(xpath, 3) + '》';
  }
  return anki_chap_info;
}

function html2text(html) {
  var text = "";
  text = html.replace(/<[^>]+>/ig, '');
  return text;
}
// 把用户输入的 Markdown 文本转换为 Anki Q&A 格式
function markdown2QA(markdown_text) {
  var qa_text = "";
  var leveled_obj = text2LeveledObj(markdown_text);
  var new_leveled_obj = postTraverse(leveled_obj, 0);

  for (var item of new_leveled_obj) {
    var xpath = getXPathInOutline(leveled_obj, item);
    if (item.children.length > 0) {
      qa_text += '-----\n\n问题：' + item.title + '\n\n' +
        getAnkiChapterInfo(item, xpath) + '\n\n答案：';
      for (var child_idx in item.children.reverse()) {
        if (child_idx == item.children.length - 1) {
          qa_text += getLineTitle(leveled_obj, item.children[child_idx]) + '\n\n';
        } else {
          qa_text += getLineTitle(leveled_obj, item.children[child_idx]) + '、';
        }
      }
    }
  }
  return qa_text;
}
// 对已经转换为 HTML 格式的文本做必要的后处理
function postProcess(input_str) {
  let output_str = "";
  output_str = regexReplG(input_str, '<img src="([^"]+)">(。|；)', '<img src="$1">');
  output_str = regexReplG(output_str, '<li>(<img[^<>]+>)<\/li>', '$1');
  output_str = regexReplG(output_str, '<ol>(<li>((?!<li>).)*<\/li>)([^<>]*<img[^<>]+>[^<>]*)<\/ol>', '<ol style="list-style:none;">$1$3</ol>');
  output_str = regexReplG(output_str, '？(。|；)', '？');
  output_str = regexReplG(output_str, '；；', '；');
  output_str = regexReplG(output_str, '。。', '。');
  return output_str;
}
// 把用户输入的 Markdown 文本转换为 AnkiCSV 导入格式
function markdown2AnkiCSV(markdown_text) {
  var anki_csv = "";  
  var leveled_obj = text2LeveledObj(markdown_text);
  var new_leveled_obj = postTraverse(leveled_obj, 0);

  for (var item of new_leveled_obj) {
    let xpath = getXPathInOutline(leveled_obj, item);
    if (item.children.length > 0) {
      anki_csv += markdown2HTML(item.title) + '\t' + 
        markdown2HTML(getAnkiChapterInfo(item, xpath)) + '\t';
    }
    if (item.children.length == 1) {
      var tmp_str = markdown2HTML(getLineTitle(leveled_obj, item.children[0]));
      anki_csv += tmp_str + '\n';
    } else if (item.children.length > 1) {
      for (var child_idx in item.children.reverse()) {
        if (child_idx == 0) {
          var tmp_str = markdown2HTML(getLineTitle(leveled_obj, item.children[child_idx]));
          anki_csv +=  '<ol><li>' + tmp_str + '</li>';
        }
        else if (child_idx == item.children.length - 1) {
          var tmp_str = markdown2HTML(getLineTitle(leveled_obj, item.children[child_idx]));
          anki_csv += '<li>' + tmp_str + '</li></ol>\n';
        } else {
          var tmp_str = markdown2HTML(getLineTitle(leveled_obj, item.children[child_idx]));
          anki_csv +=  '<li>' + tmp_str + '</li>';
        }
      }
    }
    anki_csv = postProcess(anki_csv);
  }
  return anki_csv;
}
// 点击下载按钮后，利用此方法创建文件并唤起下载动作
function download(filename, text) {
  var pom = document.createElement('a');
  pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  pom.setAttribute('download', filename);
  
  if (document.createEvent) {
    var event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    pom.dispatchEvent(event);
  }
  else {
    pom.click();
  }
}
