// 定义正则替换函数, 注意是全局替换.
function regexRepl(orig_str, regex_str, subst_str) {
	const regex = new RegExp(regex_str, 'g');
	return orig_str.replace(regex, subst_str);
}

// 对多行文本内容做必要的预处理
function preProcess(text) {
	let res_str = text;
	res_str = regexRepl(res_str.trim(), '^[\r\n]+', '');
	res_str = regexRepl(res_str.trim(), '[\r\n]+$', '');
	res_str = regexRepl(res_str.trim(), '[\r\n]+', '\n');
	return res_str;
}

// 从给定的 outline 中查找某级别的上级节点
// 注意是按照从下往上的顺序查找, 找到第一个就停止寻找
function findParent(outline, child_level) {
	let parent_idx = -1;
	for (let idx = outline.length - 1; idx >= 0; idx--) {
		if (outline[idx].level == child_level - 1) {
			parent_idx = idx;
			break;
		}
	}
	return parent_idx;
}

// 从给定的 outline 中找到某节点的父节点
// 并返回该父节点的名称
function getParentTitle(outline, child_title) {
	let parent_title = "";
	for (let item of outline) {
		if (item.hasOwnProperty('children') && 
			item.children.indexOf(child_title) >= 0) {
			parent_title = item.title;
			break;
		}
	}
	return parent_title;
}

// 把用户输入的原始文本转换为 outline 对象以便做后续处理
function text2Outline(text) {
	let clean_text = preProcess(text);
	let lines = clean_text.split("\n");  
	let outline = [];
	
	const level_regex = new RegExp('#+');
	
	for (let idx in lines) {
		let results = level_regex.exec(lines[idx]);
		let level = results[0].length;
		let title = lines[idx].replace(results[0], '').trim();
		let parent_idx = findParent(outline, level);
		if (parent_idx !== -1) {
				outline[parent_idx].children.push(title);
		}
		outline[idx] = { 'level': level, 'title': title, 'children': [] };
	}
	return outline;
}

// 对单行内容做 markdown 语法解析, 并转换为 HTML 格式
function markdown2HTML(input_str) {
	let output_str = "";
	output_str = regexRepl(input_str, '\\*{2}([^\*]+)\\*{2}', '<b>$1</b>');
	output_str = regexRepl(output_str, '\\*([^\*]+)\\*', '<span style="background-color:wheat;">$1</span>');
	output_str = regexRepl(output_str, '\\!\\[[^\[]*\\]\\(([^\(\)]*)\\)', '<img src="$1">');
	return output_str;
}

// 对已经转换为 HTML 格式的文本做必要的后处理
function postProcess(input_str) {
	let output_str = "";
	output_str = regexRepl(input_str, '<img src="([^"]+)">(。|；)', '<img src="$1">');
	output_str = regexRepl(output_str, '？(。|；)', '？');
	output_str = regexRepl(output_str, '；；', '；');
	output_str = regexRepl(output_str, '。。', '。');
	return output_str;
}

// 获取某项内容在给定的 Outline 中的 XPath
// 形如 标题1-标题1.1-标题1.1.1
function getXPathInOutline(outline, item) {
	let xpath = [];
	let parent_title = getParentTitle(outline, item.title);
	while (parent_title.length != 0) {
		xpath.unshift(markdown2HTML(parent_title));
		parent_title = getParentTitle(outline, parent_title);
	}
	return xpath.join('-');
}

function getNthLevelXPath(xpath, num) {
	let nth_level_xpath = "";
	let tmp_list = xpath.split('-').slice(0, num);
	nth_level_xpath = tmp_list.join('-');
	return nth_level_xpath;
}

function getAnkiChapterInfo(item, xpath) {
	let anki_chap_info = "";
	if (item.level == 1) {
		anki_chap_info = '《' + markdown2HTML(item.title) + '》';
	}	else if (item.level == 2) {
		anki_chap_info = '《' + xpath + '-' + markdown2HTML(item.title) + '》';
	} else {
		anki_chap_info = '《' + getNthLevelXPath(xpath, 3) + '》';
	}
	return anki_chap_info;
}

function markdown2QA(markdown_text) {
	let qa_text = "";
	let outline = text2Outline(markdown_text);
	
	for (let item of outline) {
		let xpath = getXPathInOutline(outline, item);
		if (item.children.length > 0) {
			qa_text += '-----\n\n问题：' + item.title + '\n\n' +
				getAnkiChapterInfo(item, xpath) + '\n\n答案：';
			for (let child_idx in item.children) {
				if (child_idx == item.children.length - 1) {
					qa_text += item.children[child_idx] + '\n\n';
				} else {
					qa_text += item.children[child_idx] + '、';
				}
			}
		}
	}
	return qa_text;
}

// 把用户输入的 markdown 文本转换为 Anki 专用导入格式
function markdown2Anki(markdown_text) {
	let anki_csv = "";
	let outline = text2Outline(markdown_text);
	
	for (let item of outline) {
		let xpath = getXPathInOutline(outline, item);
		if (item.children.length > 0) {
			anki_csv += markdown2HTML(item.title) + '\t' + 
				markdown2HTML(getAnkiChapterInfo(item, xpath)) + '\t';
			for (let child_idx in item.children) {
				if (child_idx == item.children.length - 1) {
					let tmp_str = markdown2HTML(item.children[child_idx]);
					anki_csv +=  tmp_str + '。\n';
				} else {
					let tmp_str = markdown2HTML(item.children[child_idx]);
					anki_csv +=  tmp_str + '；<br>';
				}
				anki_csv = postProcess(anki_csv);
			}
		}
	}
	return anki_csv;
}

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
