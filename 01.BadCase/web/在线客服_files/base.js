/**
 * Created by PhpStorm.
 * Date: 2020/04/19
 * Time: 22:19 PM
 */
;!function (win, doc) {
    "use strict";

    var whisper = function () {
            this.v = '2.1';
        }
        // 转义聊天内容中的特殊字符
        , replaceContent = function(content) {
            // 支持的html标签
            var html = function (end) {
                return new RegExp('\\n*\\[' + (end || '') + '(pre|div|span|img|br|a|em|font|strong|p|table|thead|th|tbody|tr|td|ul|li|ol|li|dl|dt|dd|h2|h3|h4|h5)([\\s\\S]*?)\\]\\n*', 'g');
            };
            content = (content || '').replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
                .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;').replace(/"/g, '&quot;') // XSS
                .replace(/@(\S+)(\s+?|$)/g, '@<a href="javascript:;">$1</a>$2') // 转义@

                .replace(/face\[([^\s\[\]]+?)\]/g, function (face) {  // 转义表情
                    var alt = face.replace(/^face/g, '');
                    return '<img alt="' + alt + '" title="' + alt + '" src="' + faces[alt] + '">';
                })
                .replace(/img\[([^\s]+?)\]/g, function (img) {  // 转义图片
                    return '<img class="layui-whisper-photos" src="' + img.replace(/(^img\[)|(\]$)/g, '') + '" style="max-width: 100%;width: 100%;height: 150px">';
                })
                .replace(/file\([\s\S]+?\)\[[\s\S]*?\]/g, function (str) { // 转义文件
                    var href = (str.match(/file\(([\s\S]+?)\)\[/) || [])[1];
                    var text = (str.match(/\)\[([\s\S]*?)\]/) || [])[1];
                    if (!href) return str;
                    return '<a class="layui-whisper-file" href="' + href + '" download target="_blank"><i class="layui-icon">&#xe61e;</i><cite>' + (text || href) + '</cite></a>';
                })
                .replace(/audio\[([^\s]+?)\]/g, function(audio){  //转义音频
                    return '<audio src="' + audio.replace(/(^audio\[)|(\]$)/g, '') + '" controls="controls" style="width: 200px;height: 20px"></audio>';
                })
                .replace(/a\([\s\S]+?\)\[[\s\S]*?\]/g, function (str) { // 转义链接
                    var href = (str.match(/a\(([\s\S]+?)\)\[/) || [])[1];
                    var text = (str.match(/\)\[([\s\S]*?)\]/) || [])[1];
                    if (!href) return str;
                    return '<a href="' + href + '" target="_blank" style="color:#1E9FFF">' + (text || href) + '</a>';
                }).replace(html(), '\<$1 $2\>').replace(html('/'), '\</$1\>') // 转移HTML代码
                .replace(/\n/g, '<br>');// 转义换行

            return content;
        }
        // 转义富媒体
        , replaceEdit = function(content) {
            var html = function (end) {
                return new RegExp('\\n*\\<' + (end || '') + '(pre|img|div|span|br|a|em|font|strong|p|table|thead|th|tbody|tr|td|ul|li|ol|li|dl|dt|dd|h2|h3|h4|h5)([\\s\\S]*?)\\>\\n*', 'g');
            };

            return content.replace(/style\s*=\s*('[^']*'|"[^"]*")/g, function(style) {
                return style.replace(/\s+/g,"").replace(/\"/g, "");
            })
                .replace(/src\s*=\s*('[^']*'|"[^"]*")/g, function(src) {
                    return src.replace(/\s+/g,"").replace(/\"/g, "")+ ' class=layui-whisper-photos style=max-width:100%;width:100%;height:150px';
                })
                .replace(/class\s*=\s*('[^']*'|"[^"]*")/g, function(cls) {
                    return cls.replace(/\s+/g,"").replace(/\"/g, "");
                })
                .replace(/href\s*=\s*('[^']*'|"[^"]*")/g, function(href) {
                    return href.replace(/\s+/g,"").replace(/\"/g, "");
                })
                .replace(/target\s*=\s*('[^']*'|"[^"]*")/g, function(tgt) {
                    return tgt.replace(/\s+/g,"").replace(/\"/g, "");
                })
                .replace(/title\s*=\s*('[^']*'|"[^"]*")/g, function(title) {
                    return title.replace(/\s+/g,"").replace(/\"/g, "");
                })
                .replace(html(), '\[$1$2\]').replace(html('/'), '\[/$1\]');
        }
        // 表情对应数组
        , getFacesIcon = function () {
            return ["[微笑]", "[嘻嘻]", "[哈哈]", "[可爱]", "[可怜]", "[挖鼻]", "[吃惊]", "[害羞]", "[挤眼]", "[闭嘴]", "[鄙视]",
                "[爱你]", "[泪]", "[偷笑]", "[亲亲]", "[生病]", "[太开心]", "[白眼]", "[右哼哼]", "[左哼哼]", "[嘘]", "[衰]",
                "[委屈]", "[吐]", "[哈欠]", "[抱抱]", "[怒]", "[疑问]", "[馋嘴]", "[拜拜]", "[思考]", "[汗]", "[困]", "[睡]",
                "[钱]", "[失望]", "[酷]", "[色]", "[哼]", "[鼓掌]", "[晕]", "[悲伤]", "[抓狂]", "[黑线]", "[阴险]", "[怒骂]",
                "[互粉]", "[心]", "[伤心]", "[猪头]", "[熊猫]", "[兔子]", "[ok]", "[耶]", "[good]", "[NO]", "[赞]", "[来]",
                "[弱]", "[草泥马]", "[神马]", "[囧]", "[浮云]", "[给力]", "[围观]", "[威武]", "[奥特曼]", "[礼物]", "[钟]",
                "[话筒]", "[蜡烛]", "[蛋糕]"]
        }
        // 表情替换
        , faces = function () {
            var alt = getFacesIcon(), arr = {};
            $.each(alt, function (index, item) {
                arr[item] = '/static/common/images/face/' + index + '.gif';
            });
            return arr;
        }()
        // 展示表情
        , showFaces = function () {
            var alt = getFacesIcon();
            var _html = '<div class="layui-whisper-face"><ul class="layui-clear whisper-face-list">';
            $.each(alt, function (index, item) {
                _html += '<li title="' + item + '" onclick="whisper.checkFace(this)"><img src="/static/common/images/face/' + index + '.gif" /></li>';
            });
            _html += '</ul></div>';

            return _html;
        };

    // 格式化时间
    Date.prototype.format = function(fmt) {
        var o = {
            "M+": this.getMonth()+1,                 // 月份
            "d+": this.getDate(),                    // 日
            "h+": this.getHours(),                   // 小时
            "m+": this.getMinutes(),                 // 分
            "s+": this.getSeconds(),                 // 秒
            "q+": Math.floor((this.getMonth()+3)/3), // 季度
            "S": this.getMilliseconds()             // 毫秒
        };

        if(/(y+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));
        }

        for(var k in o) {
            if(new RegExp("("+ k +")").test(fmt)){
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
            }
        }

        return fmt;
    };

    whisper.prototype.init = function (conf) {

    };

    // 发送消息
    whisper.prototype.send = function (content, avatar, flag) {

        return [
            '<div class="clearfloat ">'
            ,'<div class="author-name">'
            ,'<small class="chat-date">' + this.getCurrDate() + '</small>'
            ,'</div>'
            ,'<div class="right">'
            ,'<i class="layui-icon read-flag no-read" data-msg-id="' + flag + '">未读</i>'
            ,'<div class="chat-message">' + replaceContent(content) + '</div>'
            ,'<div class="chat-avatars">'
            ,'<img src="' + avatar + '">'
            ,'</div>'
            ,'</div>'
            ,'</div>'
            ,'<div style="clear:both"></div>'
        ].join('');
    };

    // 显示消息
    whisper.prototype.showMessage = function (data) {

        var readFlag = '<div class="chat-message check-read" data-msg-id="' + data.chat_log_id + '">' + replaceContent(data.content) + '</div>';
        if (2 == data.read_flag) {
            readFlag = '<div class="chat-message complete-read" data-msg-id="' + data.chat_log_id + '">' + replaceContent(data.content) + '</div>';
        }

        return [
            '<div class="clearfloat ">'
            ,'<div class="author-name">'
            ,'<small class="chat-date">' + data.time + '</small>'
            ,'</div>'
            ,'<div class="left">'
            ,'<div class="chat-avatars">'
            ,'<img src="' + data.avatar + '">'
            ,'</div>'
            ,readFlag
            ,'</div>'
            ,'</div>'
            ,'<div style="clear:both"></div>'
        ].join('');
    };

    // 发送已读dom
    whisper.prototype.completeReadSend = function (content, avatar, flag) {

        return [
            '<div class="clearfloat ">'
            ,'<div class="author-name">'
            ,'<small class="chat-date">' + this.getCurrDate() + '</small>'
            ,'</div>'
            ,'<div class="right">'
            ,'<i class="layui-icon read-flag already-read" data-msg-id="' + flag + '">已读</i>'
            ,'<div class="chat-message">' + replaceContent(content) + '</div>'
            ,'<div class="chat-avatars">'
            ,'<img src="' + avatar + '">'
            ,'</div>'
            ,'</div>'
            ,'</div>'
            ,'<div style="clear:both"></div>'
        ].join('');
    };

    // 显示聊天信息中，我发送的消息
    whisper.prototype.showMyChatLog = function (data) {

        var readFlag = '<i class="layui-icon read-flag no-read" data-msg-id="' + data.log_id + '">未读</i>';
        if (2 == data.read_flag) {
            readFlag = '<i class="layui-icon read-flag already-read" data-msg-id="' + data.log_id + '">已读</i>'
        }

        if (data.valid == 0) {
            var backHtml = '<i class="layui-icon read-flag no-read" style="color: red;margin-right: 10px">此消息被撤回</i>';
            readFlag = backHtml + readFlag;
        }

        return [
            '<div class="clearfloat ">'
            ,'<div class="author-name">'
            ,'<small class="chat-date">' + data.create_time + '</small>'
            ,'</div>'
            ,'<div class="right">'
            ,readFlag
            ,'<div class="chat-message">' + replaceContent(data.content) + '</div>'
            ,'<div class="chat-avatars">'
            ,'<img src="' + data.from_avatar + '">'
            ,'</div>'
            ,'</div>'
            ,'</div>'
            ,'<div style="clear:both"></div>'
        ].join('');
    };

    // 显示系统消息
    whisper.prototype.showSystem = function (msg) {
        return [
            '<div class="clearfloat ">'
            ,'<div class="author-name">'
            ,'<small class="chat-system">' + msg + '</small>'
            ,'</div>'
            ,'</div>'
            ,'<div style="clear:both"></div>'
        ].join('');
    };

    // 获取当前时间
    whisper.prototype.getCurrDate = function () {
        return new Date().format("yyyy-MM-dd hh:mm:ss");
    };

    // 展示表情
    whisper.prototype.showFaces = function () {
        return showFaces();
    };

    // 选择表情
    whisper.prototype.checkFace = function (obj) {
        var word = $("#textarea").val() + ' face' + $(obj).attr('title') + ' ';
        $("#textarea").val(word).focus();

        $(".layui-whisper-face").hide();
        $(".send-input").addClass('active');

        layui.use('layer', function () {
            var layer = layui.layer;

            layer.close(faceIndex);
        });
    };

    // 展示大图
    whisper.prototype.showBigPic = function () {
        $(".layui-whisper-photos").on('click', function () {
            var src = this.src;
            layer.photos({
                photos: {
                    data: [{
                        "alt": "大图模式",
                        "src": src
                    }]
                }
                , shade: 0.5
                , closeBtn: 2
                , anim: 0
                , resize: false
                , success: function (layero, index) {

                }
            });
        });
    };

    // 消息声音提醒
    whisper.prototype.voice = function () {
        $("#whisper-index-audio").get(0).play();
    };

    // 上线提示音
    whisper.prototype.newChat = function () {
        $("#whisper-new-audio").get(0).play();
    };

    // 内容替换
    whisper.prototype.replaceContent = function (text) {
        return replaceContent(text);
    };

    // 格式化标签
    whisper.prototype.replaceEdit = function(text) {
        return replaceEdit(text);
    };

    // 自动识别url连接
    whisper.prototype.autoReplaceUrl = function(text) {

        /*var reg = /(http[s]?:\/\/(www\.)?|ftp:\/\/(www\.)?|(www\.)?){1}([0-9A-Za-z-\.@:%_\+~#=]+)+((\.[a-zA-Z]{2,3})+)(\/(.)*)?(\?(.)*)?/g;
        text = text.replace(reg, function (href) {
            var regx = /^https?:\/\//i;
            if (!regx.test(href)) {
                return "a(http://" + href + ")[" + href + "]";
            } else {
                return "a(" + href + ")[" + href + "]";
            }
        });*/
        return text;
    };

    win.whisper = new whisper();
}(window, document);