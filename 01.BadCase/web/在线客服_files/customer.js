/**
 * Created by PhpStorm.
 * Date: 2020/04/19
 * Time: 22:19 PM
 */
var version = 'v2.1.17';
var debug = false;
// 服务的客服标识
var kefuCode = 0;
// 服务的客服名称
var kefuName = '';
// 是否已经连接过
var isConnect = 0;
// 访客基础信息
var customer = {
    uid: 0,
    name: '',
    avatar: '',
    seller: seller,
    tk: '',
    t: '',
    userType: 0, // 访客类型 0 随机的 1 指定的
};
// 常见问题
var comQuestion = '';
// 欢迎语
var helloWord = '';
// 是否打开
var isOpen = 0;
// 重连客服计时句柄
var reConnectInterval = 0;
// 重新接入计时句柄
var reInInterval = 0;
// 最大重新连接次数
var nowRetryNum = 1;
var maxRetryNum = 3;
// 最大重新进入次数
var nowRetryInNum = 1;
var maxRetryInNum = 3;
// 评价星级
var praiseStar = 5;
var praiseLogId = 0;
// 断网标识
var isBreak = 1;
// 会否评价断开
var isPraise = 0;
// 是否打开声音
var isOpenVoice = 1;
// 选择了转人工
var chooseService = localStorage.getItem('staff_service');
if (0 == robot_open) {
    chooseService = 1;
}
if (null == chooseService) {
    chooseService = 0;
} else if (1 == chooseService) {
    $('.staff-service').hide();
}
// 连接是否完成
var connectFinish = false;
// 是否可以咨询
var canLink = localStorage.getItem("canLink");
if (canLink == null) {
    canLink = pre_input;
}
// 信息错误尝试次数
var msgErrorRetryInTimes = 0;
var msgErrorRetryInitTimes = 0;
// 8分钟不应答，自动关闭
var noAnswerCloseTime = 8 * 60;
var faceIndex = null;
// 是否发送标识
var canSendFlag = true;
// 当前发送方式
var nowSendType = localStorage.getItem("customer-send-type");
if (!nowSendType) {
    nowSendType = 1;
}

// 统一客服不在线，留言提示语
var leaveMsgUrl = '/index/index/leaveMsg/s/' + customer.seller + '?referer=' + goback_url;
var leaveMsg = '当前无在线客服，您可以咨询机器人或者点击a('+ leaveMsgUrl + ')[留言]，进行留言。';
var defaultAvatar = window.location.origin + '/static/common/images/customer.png';

var socket = new ReconnectingWebSocket(socketUrl + "/websocket");
socket.timeoutInterval = 5400;

socket.onopen = function (res) {
    console.log("链接成功");
    connectFinish = true;
    // 兼容断网
    if (0 == isConnect && 0 == isBreak) {
        tryReIn();

        if (1 == isOpen || 2 == type) {
            tryToConnect();
        }
    }
};

socket.onclose = function (err) {
    console.log("断开连接");
    isConnect = 0;
    kefuCode = 0;
    kefuName = 0;
    isBreak = 0;

    if (0 == isPraise) {
        $.showLoading("重连中");
    }
};

socket.onmessage = function (res) {
    callBackOnMessage(res.data);
};

// 统一处理消息方法
function callBackOnMessage (data) {

    var data = eval("(" + data + ")");
    debug && console.log(data);
    switch(data['cmd']) {
        // 初始化成功
        case 'userInit':
            userInitHandle(data);
            break;

        // 访客进入
        case 'customerIn':
            customerInHandle(data);
            break;

        // 聊天消息
        case 'chatMessage':
            chatMessageHandle(data);
            break;

        // 发送消息之后
        case 'afterSend':
            afterSendHandle(data);
            break;

        // 常见问题
        case 'comQuestion':
            comQuestion = whisper.showMessage(data.data);
            if (0 == isOpen) {
                top.postMessage("show_chat", '*');
            }
            break;

        // 常见问题的回答
        case 'answerComQuestion':
            $(".chat-box").append(whisper.showMessage(data.data));
            wordBottom();
            break;

        // 问候语
        case 'hello':
            helloWord = whisper.showMessage(data.data);
            break;

        // 被关闭
        case 'isClose':
            isCloseHandle(data);
            break;

        // 处理转接
        case 'reLink':
            //console.log(data);
            relinkHandle(data);
            break;

        // 被主动接待
        case 'linkByKF':
            linkByKFHandle(data);
            break;

        // 评价客服
        case 'praiseKf':
            praiseKfHandle(data);
            break;

        // 标记已读
        case 'readMessage':
            readMessageHandle(data);
            break;

        // 撤回消息
        case 'rollBackMessage':
            rollBackMessageHandle(data);
            break;
    }
}

// 判断页面是否激活
var hiddenProperty = 'hidden' in document ? 'hidden' :
    'webkitHidden' in document ? 'webkitHidden' :
        'mozHidden' in document ? 'mozHidden' :
            null;
var visibilityChangeEvent = hiddenProperty.replace(/hidden/i, 'visibilitychange');

var onVisibilityChange = function(){
    if (!document[hiddenProperty]) {

        // 处理未读
        handleNoRead();
    }
};

document.addEventListener(visibilityChangeEvent, onVisibilityChange);

// 处理用户接受客服服务
var userInitHandle = function (data) {

    var data = data.data;
    if (400 == data.code) {
        clearInterval(reConnectInterval);
        if (nowRetryNum < maxRetryNum) {

            reConnectInterval = setInterval(function () {
                tryToConnect();
                nowRetryNum++;
            }, 2000);
        } else {

            isConnect = 0;
            if (0 == robot_open) {

                window.location.href = leaveMsgUrl;
            } else {
                showRobotService();
                showRobotServiceNotice('');
            }
        }
    } else if(0 == data.code) {

        clearInterval(reConnectInterval);
        isConnect = 1;
        isOpen = 1;

        kefuCode = data.data.kefu_code;
        kefuName = data.data.kefu_name;

        $('.chat-header-title').text(kefuName);
        $('.agent-avatar').attr('src', data.data.kefu_avatar);

        getChatLog(customer.uid, 1);
        pushCustomerReferrer(customer.uid);
        $.hideLoading();
        msgErrorRetryInitTimes = 0;
        // 启动不应答关闭机制
        clientNoResponse();
    } else if(201 == data.code) {

        clearInterval(reConnectInterval);
        isConnect = 0;
        $.hideLoading();

        if (0 == robot_open) {

            window.location.href = leaveMsgUrl;
        } else {
            showRobotService();
            showRobotServiceNotice('');
        }

    } else if(202 == data.code || 500 == data.code) {

        clearInterval(reConnectInterval);
        $(".chat-box").append(whisper.showSystem(data.msg));
        isConnect = 0;
        $.hideLoading();
    } else if(204 == data.code) {
        msgErrorRetryInitTimes++;
        if (msgErrorRetryInitTimes > 3) {
            $.alert(data.msg);
            isConnect = 0;
        } else {
            // 此处重置访客数据
            customer.uid = Number(Math.random().toString().substr(3, 4) + Date.now()).toString(36);
            localStorage.setItem('uid', customer.uid);
            customer.name = '访客' + customer.uid;
            localStorage.setItem('uName', customer.name);
            customer.avatar = defaultAvatar;
            localStorage.setItem('avatar', customer.avatar);
            customer.userType = 0;

            tryToConnect();
        }
    }
};

// 处理访客进入系统
var customerInHandle = function (data) {

    var data = data.data;
    $.hideLoading();
    if (400 == data.code) {
        clearInterval(reInInterval);
        if (nowRetryInNum < maxRetryInNum) {

            reInInterval = setInterval(function () {
                tryReIn();
                nowRetryInNum++;
            }, 1000);
        } else {

            isConnect = 0;

            if (0 == robot_open) {

                window.location.href = leaveMsgUrl;
            } else {
                showRobotService();
                showRobotServiceNotice('');
            }
        }
    } else if(0 == data.code) {

        clearInterval(reInInterval);
        msgErrorRetryInTimes = 0;
        if (0 == isOpen) {
            top.postMessage("init_complete", '*');
        }
    } else if(201 == data.code) {
        isConnect = 0;

        if (0 == robot_open) {

            window.location.href = leaveMsgUrl;
        } else {
            showRobotService();
            showRobotServiceNotice('');
        }
    } else if(204 == data.code) {
        msgErrorRetryInTimes++;
        if (msgErrorRetryInTimes > 3) {
            $.alert(data.msg);
        } else {
            // 此处重置访客数据
            customer.uid = Number(Math.random().toString().substr(3, 4) + Date.now()).toString(36);
            localStorage.setItem('uid', customer.uid);
            customer.name = '访客' + customer.uid;
            localStorage.setItem('uName', customer.name);
            customer.avatar = defaultAvatar;
            localStorage.setItem('avatar', customer.avatar);
            customer.userType = 0;

            tryReIn();
        }
    }
};

// 处理聊天数据
var chatMessageHandle = function (data) {

    var chatMsg = whisper.showMessage(data.data);
    $(".chat-box").append(chatMsg);
    wordBottom();
    whisper.showBigPic();

    if (1 == type) {

        if (0 == isOpen) {
            top.postMessage("show_chat", '*');
        }

        // 处理未读
        handleNoRead();
    } else if (2 == type) {

        if (!document.hidden) {
            handleNoRead();
        }
    }

    whisper.voice();
};

// 发送消息之后
var afterSendHandle = function (data) {

    var data = data.data;
    var input = data.msg;
    if (400 == data.code) {

        var msg = whisper.send(input, customer.avatar, data.data);
    } else if (0 == data.code) {
        var msg = whisper.send(input, customer.avatar, data.data);
    }

    $(".chat-box").append(msg);
    $("#textarea").val('');

    $(this).removeClass('active');
    canSendFlag = true;

    wordBottom();
    whisper.showBigPic();
};

// 处理被关闭
var isCloseHandle = function (data) {

    kefuCode = 0;
    kefuName = '';

    isConnect = 0;
    if (0 == robot_open) {

        window.location.href = leaveMsgUrl;
    } else {
        showRobotService();
        showRobotServiceNotice('');
    }
};

// 处理转接
var relinkHandle = function (data) {

    kefuCode = data.data.kefu_code;
    kefuName = data.data.kefu_name;

    $('.chat-header-title').text(kefuName);

    $(".chat-box").append(whisper.showSystem(data.data.msg));
    wordBottom();
};

// 处理被主动接待
var linkByKFHandle = function (data) {

    isConnect = 1;
    kefuCode = data.data.kefu_code;
    kefuName = data.data.kefu_name;

    $('.chat-header-title').text(kefuName);
    // 关闭机器人服务描述
    chooseService = 1;
    localStorage.setItem('staff_service', '1');
    $('.staff-service').hide();

    if (0 == isOpen) {
        isConnect = 1;
        top.postMessage("show_chat", '*');
    }
    getChatLog(customer.uid, 1);
};

// 处理评价客服
var praiseKfHandle = function (data) {

    if (0 == isOpen) {
        isConnect = 1;
        top.postMessage("show_chat", '*');
    }

    getChatLog(customer.uid, 1);
    showPraise(data.data.service_log_id);
    // 设为机器人服务
    localStorage.setItem('staff_service', '0');
};

// 处理已读问题
var readMessageHandle = function (data) {

    var data = data.data;
    if (1 == type && 1 == isOpen) {

        $('.chat-box').find('.no-read').each(function () {
            var mid = data.mid.split(',');
            if (-1 != $.inArray($(this).attr('data-msg-id'), mid)) {
                $(this).removeClass('no-read').addClass("already-read").text('已读');
            }
        });
    } else if (2 == type) {

        $('.chat-box').find('.no-read').each(function () {
            var mid = data.mid.split(',');
            if (-1 != $.inArray($(this).attr('data-msg-id'), mid)) {
                $(this).removeClass('no-read').addClass("already-read").text('已读');
            }
        });
    }
};

// 尝试连接客服
var tryToConnect = function () {

    customer.tk = tk;
    customer.t = t;

    if (connectFinish) {
        socket.send(JSON.stringify({
            cmd: "userInit",
            data: customer
        }));
    } else {

        $.showLoading('连接中...');
        var sendInitInterval = setInterval(function () {
            if (connectFinish) {
                socket.send(JSON.stringify({
                    cmd: "userInit",
                    data: customer
                }));
                clearInterval(sendInitInterval);
            }
        }, 200);
    }
};

// 尝试直接连接指定客服
var tryDirectLinkKeFu = function () {

    customer.tk = tk;
    customer.t = t;
    customer.kefu_code = direct_kefu;

    if (connectFinish) {
        socket.send(JSON.stringify({
            cmd: "directLinkKF",
            data: customer
        }));
    } else {
        $.showLoading('连接中...');
        var sendInitInterval = setInterval(function () {
            if (connectFinish) {
                socket.send(JSON.stringify({
                    cmd: "directLinkKF",
                    data: customer
                }));
                clearInterval(sendInitInterval);
            }
        }, 200);
    }
};

// 尝试接入
var tryReIn = function () {

    if (!customer.uid) {
        customer.uid = Number(Math.random().toString().substr(3, 4) + Date.now()).toString(36);
        localStorage.setItem('uid', customer.uid);

        customer.name = '访客' + customer.uid;
        localStorage.setItem('uName', customer.name);

        customer.avatar = defaultAvatar;
        localStorage.setItem('avatar', customer.avatar);
        customer.userType = 0;
    }

    if (connectFinish) {
        socket.send(JSON.stringify({
            cmd: "customerIn",
            data: {
                customer_id: customer.uid,
                customer_name: customer.name,
                customer_avatar: customer.avatar,
                seller_code: seller,
                tk: tk,
                t: t,
                userType: customer.userType
            }
        }));
    } else {
        var sendInitInterval3 = setInterval(function () {
            if (connectFinish) {
                socket.send(JSON.stringify({
                    cmd: "customerIn",
                    data: {
                        customer_id: customer.uid,
                        customer_name: customer.name,
                        customer_avatar: customer.avatar,
                        seller_code: seller,
                        tk: tk,
                        t: t,
                        userType: customer.userType
                    }
                }));
                clearInterval(sendInitInterval3);
            }
        }, 200);
    }
};

// 已选择人工客服
var staffService = function () {

    // 直连接入
    if (2 == type) {

        // 若指定了用户信息
        if (customerId.length > 0) {

            localStorage.setItem('uid', customerId);
            customer.userType = 1;
            localStorage.setItem('userType', 1);

            customer.uid = customerId;
            if (cusotmerName.length > 0) {
                customer.name = cusotmerName;
            } else {
                customer.name = '访客' + customerId;
            }
            localStorage.setItem('uName', customer.name);

            if (avatar.length > 0) {
                customer.avatar = avatar;
            } else {
                customer.avatar = defaultAvatar;
            }
            localStorage.setItem('avatar', customer.avatar);

        } else {

            var tmpUid = localStorage.getItem('uid');
            customer.userType = 0;
            localStorage.setItem('userType', 0);

            if (tmpUid == null) {
                tmpUid = Number(Math.random().toString().substr(3, 4) + Date.now()).toString(36);
                localStorage.setItem('uid', tmpUid);

                customer.uid = tmpUid;
                customer.name = '访客' + tmpUid;
                localStorage.setItem('uName', customer.name);
                customer.avatar = defaultAvatar;
                localStorage.setItem('avatar', customer.avatar);
            } else {

                customer.uid = tmpUid;
                customer.name = localStorage.getItem('uName');
                customer.avatar = localStorage.getItem('avatar');
            }
        }

        customer.type = 2;
        localStorage.setItem('whisper_referrer', document.referrer);

        // 固定连接
        if(0 == isConnect) {
            if (direct_kefu != '') {
                preInputCheck(2);
            } else {
                preInputCheck(1);
            }
        }

    } else if (1 == type) {
        // 弹层接入
        window.addEventListener('message', function(event){
            var msg = JSON.parse(event.data);
            if('open_chat' == msg.cmd) {
                isOpen = 1;
                if(0 == isConnect) {
                    preInputCheck(1);
                }
            } else if('c_info' == msg.cmd) {
                customer.uid = msg.data.uid;
                customer.name = msg.data.uName;
                customer.avatar = msg.data.avatar;
                customer.userType = msg.data.userType;

                if (msg.data.uid == null) {
                    var tmpUid = Number(Math.random().toString().substr(3, 4) + Date.now()).toString(36);
                    customer.uid = tmpUid;
                    customer.name = '访客' + tmpUid;
                    customer.avatar = defaultAvatar;
                    customer.userType = 0;
                }

                localStorage.setItem('whisper_referrer', msg.data.referrer);

                // 访客进入
                tryReIn();
            }
        }, false);
    }
};

// 主动点击人工客服
var staffServiceHandle = function () {

    // 直连接入
    if (2 == type) {

        var tmpUid = localStorage.getItem('uid');
        customer.userType = localStorage.getItem('userType');

        if (tmpUid == null) {
            tmpUid = Number(Math.random().toString().substr(3, 4) + Date.now()).toString(36);
            localStorage.setItem('uid', tmpUid);
            customer.userType = 0;
            localStorage.setItem('userType', 0);
        }

        if (cusotmerName.length > 0) {
            customer.name = cusotmerName;
        } else {
            customer.name = '访客' + tmpUid;
        }
        localStorage.setItem('uName', customer.name);

        if (avatar.length > 0) {
            customer.avatar = avatar;
        } else {
            customer.avatar = defaultAvatar;
        }
        localStorage.setItem('avatar', customer.avatar);

        customer.type = 2;
        localStorage.setItem('whisper_referrer', document.referrer);

        // 固定连接
        if(0 == isConnect) {
            if (direct_kefu != '') {
                preInputCheck(2);
            } else {
                preInputCheck(1);
            }
        }

    } else if (1 == type) {
        // 弹层接入
        if(0 == isConnect) {
            preInputCheck(1);
        }
    }
};

// 机器人服务
var robotService = function () {

    if (2 == type) {
        // 若指定了用户信息
        if (customerId.length > 0) {

            localStorage.setItem('uid', customerId);
            customer.userType = 1;
            localStorage.setItem('userType', 1);

            customer.uid = customerId;
            if (cusotmerName.length > 0) {
                customer.name = cusotmerName;
            } else {
                customer.name = '访客' + customerId;
            }
            localStorage.setItem('uName', customer.name);

            if (avatar.length > 0) {
                customer.avatar = avatar;
            } else {
                customer.avatar = defaultAvatar;
            }
            localStorage.setItem('avatar', customer.avatar);

        } else {

            var tmpUid = localStorage.getItem('uid');
            customer.userType = 0;
            localStorage.setItem('userType', 0);

            if (tmpUid == null) {
                tmpUid = Number(Math.random().toString().substr(3, 4) + Date.now()).toString(36);
                localStorage.setItem('uid', tmpUid);
            }

            customer.uid = tmpUid;
            customer.name = '访客' + tmpUid;
            localStorage.setItem('uName', customer.name);
            customer.avatar = defaultAvatar;
            localStorage.setItem('avatar', customer.avatar);
        }

        customer.type = 2;
        localStorage.setItem('whisper_referrer', document.referrer);

        var robotHello = whisper.showMessage({
            read_flag: 2,
            chat_log_id: 0,
            content: robot_hello,
            time: whisper.getCurrDate(),
            avatar: '/static/common/images/robot.jpg'
        });

        $(".chat-box").append(robotHello);
        getChatLog(customer.uid, 1);
    } else {

        window.addEventListener('message', function(event){
            var msg = JSON.parse(event.data);
            if('open_chat' == msg.cmd) {
                isOpen = 1;

                var robotHello = whisper.showMessage({
                    read_flag: 2,
                    chat_log_id: 0,
                    content: robot_hello,
                    time: whisper.getCurrDate(),
                    avatar: '/static/common/images/robot.jpg'
                });

                $(".chat-box").append(robotHello);
                getChatLog(customer.uid, 1);
            } else if('c_info' == msg.cmd) {

                customer.uid = msg.data.uid;
                customer.name = msg.data.uName;
                customer.avatar = msg.data.avatar;
                customer.userType = msg.data.userType;

                if (msg.data.uid == null) {
                    var tmpUid = Number(Math.random().toString().substr(3, 4) + Date.now()).toString(36);
                    customer.uid = tmpUid;
                    customer.name = '访客' + tmpUid;
                    customer.avatar = defaultAvatar;
                    customer.userType = 0;
                }

                localStorage.setItem('whisper_referrer', msg.data.referrer);

                // 访客进入
                tryReIn();
            }
        }, false);
    }
};

// 展示机器人服务消息
var showRobotServiceNotice = function (content) {

    if ('' == content) {
        content = leaveMsg;
    }

    var robotHello = whisper.showMessage({
        read_flag: 2,
        chat_log_id: 0,
        content: content,
        time: whisper.getCurrDate(),
        avatar: '/static/common/images/robot.jpg'
    });

    $(".chat-box").append(robotHello);
    wordBottom();
};

// 机器人问答
var robotAnswer = function () {

    $("#sendBtn").removeClass('active');
    $('.chat-set').removeClass('chat-set-active');

    var input = $("#textarea").val();
    if (input.replace(/^\s*|\s*$/g,"") == '') {
        return false;
    }

    var msg = whisper.completeReadSend(input, customer.avatar, 0);
    $(".chat-box").append(msg);
    $("#textarea").val('');
    wordBottom();

    $.post('/index/robot/service', {
        seller_id: seller_id,
        q: input,
        seller_code: customer.seller,
        from_id: customer.uid,
        from_name: customer.name,
        from_avatar: customer.avatar
    }, function (res) {

        var robotHello = whisper.showMessage({
            read_flag: 2,
            chat_log_id: 0,
            content: res.msg,
            time: whisper.getCurrDate(),
            avatar: '/static/common/images/robot.jpg'
        });

        $(".chat-box").append(robotHello);
        wordBottom();
    }, 'json');
};

// 显示机器人服务
var showRobotService = function () {

    chooseService = 0;
    localStorage.setItem('staff_service', "0");
    $('.chat-header-title').text(robot_title);

    var robotHello = whisper.showMessage({
        read_flag: 2,
        chat_log_id: 0,
        content: robot_hello,
        time: whisper.getCurrDate(),
        avatar: '/static/common/images/robot.jpg'
    });

    $(".chat-box").append(robotHello);
    wordBottom();

    $(".staff-service").show();
};

$(function () {
    // 点击返回
    $(".chat-back").click(function () {
        window.location.href = document.referrer;
    });

    // 处理粘贴事件
    listenPaste();

    // 人工客服和机器人客服切换
    if (0 == chooseService && 1 == robot_open) {
        robotService();
    } else {
        staffService();
    }

    // 最小化
    $("#closeBtn").on('click', function () {
        if (os == 'm' && type == 2) {
            window.location.href = document.referrer;
        } else {
            isOpen = 0;
            window.parent.postMessage("hide_chat", '*');
        }
    });

    // 发送
    if (os == 'm') {
        var sendObj = document.getElementById("sendBtn");
        sendObj.addEventListener('touchend', function(e) {
            sendMessage('');
            $("#sendBtn").removeClass('active');
            $('.chat-set').removeClass('chat-set-active');
        });
    } else {
        $("#sendBtn").on('click', function () {
            sendMessage('');
            $("#sendBtn").removeClass('active');
            $('.chat-set').removeClass('chat-set-active');
        });
    }

    // 输入监听
    $("#textarea").keyup(function () {
        var len = $(this).val().length;
        if(len == 0) {
            $("#sendBtn").removeClass('active');
            $('.chat-set').removeClass('chat-set-active');
        } else if(len >0 && !$("#sendBtn").hasClass('active')) {
            $("#sendBtn").addClass('active');
            $('.chat-set').addClass('chat-set-active');

        }
    });

    // 实时发送自己的输入，供客服预览
    if (pre_see) {
        $("#textarea").bind("input propertychange",function(event){
            var inputWord = $(this).val();
            socket.send(
                JSON.stringify({
                    cmd: 'typing',
                    data: {
                        from_name: customer.name,
                        from_avatar: customer.avatar,
                        from_id: customer.uid,
                        to_id: kefuCode,
                        to_name: kefuName,
                        content: inputWord,
                        seller_code: seller
                    }
                }));
        });
    }

    // 点击表情
    var index;
    $("#face").on('click', function (e) {
        e.stopPropagation();
        layui.use(['layer'], function () {
            var layer = layui.layer;

            var isShow = $(".layui-whisper-face").css('display');
            if ('block' == isShow) {
                layer.close(index);
                return;
            }
            if (type == 2) {

                var offsetTop = $(".tool-box").offset().top - 218;
                var offsetLeft = $(".chat-body").offset().left;
                if (offsetLeft > 0){
                    offsetLeft += 10;
                }
            }

            layer.ready(function () {
                faceIndex = layer.open({
                    type: 1,
                    offset: [offsetTop + 'px', offsetLeft + 'px'],
                    shade: 0.1,
                    title: false,
                    shadeClose: true,
                    closeBtn: 0,
                    area: '395px',
                    content: whisper.showFaces()
                });
            });
        });
    });

    // 监听快捷键发送
    document.getElementById('textarea').addEventListener('keydown', function (e) {
        if (type == 2) {

            if (nowSendType == 1 && e.keyCode == 13) {

                e.preventDefault();
                sendMessage('');
            } else if (nowSendType == 2 && event.ctrlKey && event.keyCode == 13) {

                e.preventDefault();
                sendMessage('');
            }

        } else if(type == 1) {
            if (e.keyCode != 13) return;
            e.preventDefault();
            sendMessage('');
        }
    });

    // 录音发送
    $('#voice').click(function () {
        // notice 新的策略，必须是用户点击事件调用这个方法才能录音
        audio_context.resume().then(() => {
            console.log('Playback resumed successfully');
        });

        startRecording();

        var vindx = layer.open({
            type: 1
            ,title: false // 不显示标题栏
            ,closeBtn: false
            ,area: '250px;'
            ,shade: 0.3
            ,id: 'LAY_layuipro' // 设定一个id，防止重复弹出
            ,resize: false
            ,btn: ['完成发送', '放弃发送']
            ,btnAlign: 'c'
            ,moveType: 1 // 拖拽模式，0或者1
            ,content: '<div style="padding: 50px; line-height: 22px; background-color: #393D49; color: #fff; font-weight: 300;">录音中，请说话......</div>'
            ,yes: function(){
                stopRecording();
                layer.close(vindx);
            }
        });
    });

    // 开启关闭声音
    $("#operatorVoice").click(function () {
        if (0 == isOpenVoice) {
            $("#openVoice").show();
            $("#closeVoice").hide();
            isOpenVoice = 1;
            whisper.voice();
        } else {
            $("#openVoice").hide();
            $("#closeVoice").show();
            isOpenVoice = 0;
        }
    });

    // 转人工服务
    $(".staff-service").click(function () {

        staffServiceHandle();
        chooseService = 1; // 人工服务
        localStorage.setItem('staff_service', "1");
        $(this).hide();
    });

    // 设置发送快捷点
    $(".chat-set").click(function () {
        if ($(".chat-set-menu").css('display') == 'block') {
            $(".chat-set-menu").hide();
        } else {
            $(".chat-set-menu").show();
            $("#send-type-" + nowSendType).removeClass('show-this')
                .addClass('show-this').siblings().removeClass('show-this');
        }

        $(document).mouseup(function (e) {
            if(!$(".chat-set-menu").is(e.target) && $(".chat-set-menu").has(e.target).length === 0) {
                $(".chat-set-menu").hide();
            }
        })
    });

    $("#send-type-1").click(function () {
        nowSendType = 1;
        localStorage.setItem("customer-send-type", "1");
        $(this).removeClass('show-this')
            .addClass('show-this').siblings().removeClass('show-this');

        setTimeout(function () {
            $(".chat-set-menu").hide();
        }, 300);
    });

    $("#send-type-2").click(function () {
        nowSendType = 2;
        localStorage.setItem("customer-send-type", "2");
        $(this).removeClass('show-this')
            .addClass('show-this').siblings().removeClass('show-this');

        setTimeout(function () {
            $(".chat-set-menu").hide();
        }, 300);
    });
});

// 发送消息
function sendMessage(inMsg) {

    // 机器人服务
    if (0 == chooseService) {

        robotAnswer();
        return false;
    }

    if(kefuCode == 0) {

        layui.use('layer', function () {
            var layer = layui.layer;
            layer.msg('暂无客服提供服务', {anim: 6});
        });

        return ;
    }

    if('' == inMsg) {
        var input = $("#textarea").val();
    } else {
        var input = inMsg;
    }

    if(input.length == 0 || input.replace(/^\s*|\s*$/g,"") == '') {
        return ;
    }

    if (input.substr(0, 4) != 'img[' && input.substr(0, 5) != 'file(') {
        input = whisper.autoReplaceUrl(input);
    }

    if (!canSendFlag) {
        return;
    }
    canSendFlag = false;

    socket.send(JSON.stringify({
        cmd: "chatMessage",
        data: {
            from_name: customer.name,
            from_avatar: customer.avatar,
            from_id: customer.uid,
            to_id: kefuCode,
            to_name: kefuName,
            content: input,
            seller_code: seller
        }
    }));

    // 启动不应答关闭机制
    clientNoResponse();
}

// 获取聊天记录
function getChatLog(uid, page, flag, bottom) {

    $.getJSON('/index/index/getChatLog', {uid: uid, page: page, tk: tk, t: t, u: seller}, function(res){
        if(0 == res.code && res.data.length > 0) {

            if(res.msg == res.total){
                var _html = '<div class="clearfloat"><div class="author-name"><small>没有更多了</small></div><div style="clear:both"></div></div>';
            }else{
                var _html = '<div class="clearfloat"><div class="author-name" data-page="' + parseInt(res.msg + 1)
                    + '" onclick="getMore(this)"><small class="chat-system">更多记录</small></div><div style="clear:both"></div></div>';
            }

            $.each(res.data, function (k, v) {
                if(v.type == 'mine') {

                    _html += whisper.showMyChatLog(v);
                } else if(v.type == 'user'){

                    _html += whisper.showMessage({time: v.create_time, avatar: v.from_avatar, content: v.content, chat_log_id: v.log_id, read_flag: v.read_flag});
                }
            });

            if(typeof flag == 'undefined'){
                $(".chat-box").html(_html);
            }else{
                $(".chat-box").prepend(_html);
            }

            whisper.showBigPic();

            if (helloWord != '') {
                $(".chat-box").append(helloWord);
            }

            if (comQuestion != null) {
                $(".chat-box").append(comQuestion);
            }

            if(typeof bottom == 'undefined') {
                wordBottom();
            }
        } else if (0 == res.code && res.data.length == '') {

            if (helloWord != '') {
                $(".chat-box").append(helloWord);
            }

            if (comQuestion != null) {
                $(".chat-box").append(comQuestion);
            }

            wordBottom();
        }

        handleNoRead();
    });
}

// 发送来路信息
function pushCustomerReferrer(customerId) {
    $.getJSON('/index/index/updateUserInfo', {
        customer_id: customerId,
        seller_code: seller,
        referrer: localStorage.getItem('whisper_referrer'),
        agent: agent
    }, function (res) {});
}

// 获取更多的的记录
function getMore(obj) {
    $(obj).remove();

    var page = $(obj).attr('data-page');

    getChatLog(customer.uid, page, 1, 1);
}

// 滚动到最底端
function wordBottom() {
    var box = $(".chat-box");

    box.scrollTop(box[0].scrollHeight);
}

// 图片 文件上传
layui.use(['upload', 'layer'], function () {
    var upload = layui.upload;
    var layer = layui.layer;

    var index;
    upload.render({
        elem: '#image'
        , accept: 'images'
        , acceptMime: 'image/*'
        , exts: 'jpg|jpeg|png|gif'
        , url: '/index/upload/uploadImg'
        , before: function () {
            index = layer.load(0, {shade: false});
        }
        , done: function (res) {
            layer.close(index);
            sendMessage('img[' + res.data.src + ']');
            whisper.showBigPic();
        }
        , error: function () {
            // 请求异常回调
        }
    });

    upload.render({
        elem: '#file'
        , accept: 'file'
        , exts: 'zip|rar|txt|doc|docx|xls|xlsx'
        , url: '/index/upload/uploadFile'
        , before: function () {
            index = layer.load(0, {shade: false});
        }
        , done: function (res) {
            layer.close(index);
            sendMessage('file(' + res.data.src + ')[' + res.data.name + ']');
            whisper.showBigPic();
        }
        , error: function () {
            // 请求异常回调
        }
    });
});

// 点击常见问题
function autoAnswer (obj) {
    var questionId = $(obj).attr('data-id');
    var question = $(obj).text();

    socket.send(JSON.stringify({
        cmd: "comQuestion",
        data: {
            question_id: questionId,
            seller_code: seller
        }
    }));

    var msg = whisper.completeReadSend(question, customer.avatar, 0);
    $(".chat-box").append(msg);

    wordBottom();
    whisper.showBigPic();
    if (0 == isOpen) {
        top.postMessage("show_chat", '*');
    }
}

// 机器人自动回答
function robotAutoAnswer (obj) {
    var questionId = $(obj).attr('data-id');
    var question = $(obj).text();

    $.post('/index/robot/autoAnswer', {
        id: questionId,
        sid: seller_id,
        seller_code: customer.seller,
        from_id: customer.uid,
        from_name: customer.name,
        from_avatar: customer.avatar
    }, function (res) {

        var msg = whisper.completeReadSend(question, customer.avatar, 1);
        $(".chat-box").append(msg);

        var msg = whisper.showMessage({
            read_flag: 2,
            chat_log_id: 0,
            content: res.msg,
            time: whisper.getCurrDate(),
            avatar: '/static/common/images/robot.jpg'
        });
        $(".chat-box").append(msg);

        wordBottom();
        whisper.showBigPic();
    }, 'json');
}

// 展示评价
function showPraise(log_id) {

    layui.use(['rate', 'layer'], function(){
        var rate = layui.rate;
        var layer = layui.layer;

        var ins1 = rate.render({
            elem: '#praise_star'
            ,setText: function(value){
                var arrs = {
                    '1': '非常不满意'
                    ,'2': '不满意'
                    ,'3': '一般'
                    ,'4': '满意'
                    ,'5': '非常满意'
                };
                this.span.text(arrs[value] || ( value + "星"));

                praiseStar = value;
            }
            ,value: praiseStar
            ,text: true
        });

        layer.open({
            type: 1,
            title: '',
            closeBtn: false,
            area: ['250px', '180px'],
            content: $("#praise_box"),
            btn: ['确定'],
            yes: function(index, layero){

                $.post('/index/index/praise', {
                    customer_id: customer.uid,
                    kefu_code: kefuCode,
                    seller_code: customer.seller,
                    service_log_id: log_id,
                    star: praiseStar
                }, function (res) {

                    $(".chat-box").append(whisper.showSystem(res.msg));
                    isPraise = 1;
                    socket.close();
                    wordBottom();
                    kefuCode = 0;
                    kefuName = '';

                    layer.close(index);
                }, 'json');
            }
        });
    });
}

// 监听粘贴事件
function listenPaste() {
    // 监听粘贴事件
    document.getElementById('textarea').addEventListener('paste', function(e){
        $("#sendBtn").addClass('active');
        $('.chat-set').addClass('chat-set-active');
        // 添加到事件对象中的访问系统剪贴板的接口
        var clipboardData = e.clipboardData,
            i = 0,
            items, item, types;

        if (clipboardData) {
            items = clipboardData.items;
            if (!items) {
                return;
            }
            item = items[0];
            // 保存在剪贴板中的数据类型
            types = clipboardData.types || [];
            for (; i < types.length; i++) {
                if (types[i] === 'Files') {
                    item = items[i];
                    break;
                }
            }

            // 判断是否为图片数据
            if (item && item.kind === 'file' && item.type.match(/^image\//i)) {

                var fileType = [
                    'image/jpg',
                    'image/png',
                    'image/jpeg',
                    'image/gif'
                ];

                if(-1 == $.inArray(item.type, fileType)){
                    layer.msg("只支持jpg,jpeg,png,gif");
                    return false;
                }

                var fileType = item.type.lastIndexOf('/');
                var suffix = item.type.substring(fileType+1, item.type.length);

                var blob = item.getAsFile();
                var fileName =  new Date().valueOf() + '.' + suffix;

                var formData = new FormData();
                formData.append('name', fileName);
                formData.append('file', blob);

                var request = new XMLHttpRequest();
                var uploading = null;
                request.upload.onprogress = function (event) {
                    uploading = layer.load(0, {shade: false});
                };

                request.onreadystatechange = function() {
                    if (request.readyState == 4 && request.status == 200) {
                        layer.close(uploading);
                        var res = eval('(' + request.response + ')');
                        var area = ['300px', '300px'];
                        if (os == 'p' && 2 == type) {
                            area = ['500px', '500px'];
                        }
                        if(res.code == 0){
                            layer.photos({
                                photos: {
                                    data: [{
                                        "src": res.data.src
                                    }]
                                }
                                , area: area
                                , shade: 0.5
                                , closeBtn: 0
                                , btn: ['确定发送', '粘贴错了']
                                , anim: 0
                                , resize: false
                                , yes: function (index, layero) {
                                    $("#textarea").val('img['+ (res.data.src||'') +']');
                                    $("#sendBtn").addClass('active');
                                    $('.chat-set').addClass('chat-set-active');
                                    layer.close(index);
                                }
                            });
                        } else {
                            layer.msg(res.msg||'粘贴失败');
                            $("#sendBtn").removeClass('active');
                            $('.chat-set').removeClass('chat-set-active');
                        }
                    }
                };
                // upload error callback
                request.upload.onerror = function(error) {
                    layer.msg(res.msg||'粘贴失败');
                };
                // upload abort callback
                request.upload.onabort = function(error) {
                    layer.msg(res.msg||'粘贴失败');
                };

                request.open('POST', '/index/upload/uploadImg/');
                request.send(formData);

                //imgReader(item, data.id);
            }
        }
    });
}

// 处理未读
function handleNoRead() {

    var noReadIds = [];
    // 检测全局未读
    $('.chat-box').find(".check-read").each(function () {
        if ($(this).attr('data-msg-id') != "undefined") {
            noReadIds.push($(this).attr('data-msg-id'));
        }
    });

    // 有未读的数据
    if (noReadIds.length > 0) {

        socket.send(JSON.stringify({
            cmd: "readMessage",
            data: {
                uid: kefuCode,
                mid: noReadIds.join(',')
            }
        }));

        $('.chat-box').find(".check-read").removeClass('check-read').addClass('complete-read');
    }
}

// 撤回消息
function rollBackMessageHandle(data) {

    $('.chat-box').find(".chat-message").each(function () {
        if ($(this).attr('data-msg-id') == data.data.mid) {
            $(this).parent().parent().remove();
        }
    });
}

// 咨询前输入咨询内容
function preInputCheck(flag) {

    if (canLink == 1) {
        layui.use('layer', function () {
            var layer = layui.layer;

            var height = '90%';
            var width = '90%';
            if (type == 2 && os == 'p') {
                height = '400px';
                width = '400px';
            }
            layer.ready(function () {
                var index = layer.open({
                    title: '',
                    closeBtn: 0,
                    type: 1,
                    area: [width, height],
                    content: $("#msg-box")
                });

                $("#sub-btn").on('click', function () {

                    var form = $("#pre-form").serialize();

                    localStorage.setItem("canLink", 0);
                    canLink = 0;

                    $.post('/index/index/updateCustomerData', {
                        customer_id: customer.uid,
                        seller_code: seller,
                        self_content: form
                    }, function (res) {

                        if (flag == 1) {
                            tryToConnect();
                        } else if (flag == 2) {
                            tryDirectLinkKeFu();
                        }

                        layer.close(index);
                    }, 'json');
                });
            });
        });
    } else {

        if (flag == 1) {
            tryToConnect();
        } else if (flag == 2) {
            tryDirectLinkKeFu();
        }
    }
}

// 处理长时间不响应
function clientNoResponse() {
    if (noAnswerCloseTime > 0){
        console.log('启动');
        // 重置消息间隔时间
        window.msgSpaceSeconds = 0;
        clearInterval(window.msgSpaceInterval);
        window.msgSpaceInterval = setInterval(function () {
            window.msgSpaceSeconds += 1;
            // 3 分钟未响应，断开
            if (window.msgSpaceSeconds >= noAnswerCloseTime){
                clearInterval(window.msgSpaceInterval);
                isPraise = 1;
                socket.close();
                $(".chat-box").append(whisper.showSystem('由于您长时间未进行对话，本次对话已结束'));
                wordBottom();
            }
        },1000);
    }
}

// 简单粗暴的心跳
timeInterval = setInterval(function () {
    if (connectFinish) {
        socket.send(JSON.stringify({
            cmd: "ping"
        }))
    }
}, 20000);