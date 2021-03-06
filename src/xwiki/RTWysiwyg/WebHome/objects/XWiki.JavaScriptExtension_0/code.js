;(function() {
    // VELOCITY
    var WEBSOCKET_URL = "$!services.websocket.getURL('realtime')";
    var USER = "$!xcontext.getUserReference()" || "xwiki:XWiki.XWikiGuest";
    var PRETTY_USER = "$xwiki.getUserName($xcontext.getUser(), false)";
    var DEMO_MODE = "$!request.getParameter('demoMode')" || false;
    var DEFAULT_LANGUAGE = "$xwiki.getXWikiPreference('default_language')";
    var LOCALSTORAGE_DISALLOW = 'rtwysiwyg-disallow';
    var MESSAGES = {
        allowRealtime: "Allow Realtime Collaboration", // TODO: translate
        joinSession: "Join Realtime Collaborative Session",

        disconnected: "Disconnected",
        myself: "Myself",
        guest: "Guest",
        guests: "Guests",
        and: "and",
        editingWith: "Editing With:",
        debug: "Debug",
        lag: "Lag:"
    };
    var PATHS = {
        RTWysiwyg_WebHome_chainpad: "$doc.getAttachmentURL('chainpad.js')",
        RTWysiwyg_WebHome_realtime_wysiwyg: "$doc.getAttachmentURL('realtime-wysiwyg.js')",
        RTWysiwyg_WebHome_realtime_cleartext: "$doc.getAttachmentURL('realtime-cleartext.js')",

        // RTWysiwyg_WebHome_convert: "$doc.getAttachmentURL('convert.js')",
        RTWysiwyg_WebHome_toolbar: "$doc.getAttachmentURL('toolbar.js')",
        RTWysiwyg_WebHome_cursor: "$doc.getAttachmentURL('cursor.js')",
        RTWysiwyg_WebHome_json_ot: "$doc.getAttachmentURL('json-ot.js')",

        RTWysiwyg_WebHome_hyperjson: "$doc.getAttachmentURL('hyperjson.js')",
        RTWysiwyg_WebHome_hyperscript: "$doc.getAttachmentURL('hyperscript.js')",

        RTWysiwyg_WebHome_treesome: "$doc.getAttachmentURL('treesome.js')",
        RTWysiwyg_WebHome_sharejs_textarea: "$doc.getAttachmentURL('sharejs_textarea.js')",

        RTWysiwyg_WebHome_diffDOM: "$doc.getAttachmentURL('diffDOM.js')",

        RTWysiwyg_WebHome_messages: "$doc.getAttachmentURL('messages.js')",
        RTWysiwyg_WebHome_reconnecting_websocket: "$doc.getAttachmentURL('reconnecting-websocket.js')",

        RTWysiwyg_WebHome_rangy: "$doc.getAttachmentURL('rangy-core.min.js')",
        RTWysiwyg_ErrorBox: "$xwiki.getURL('RTWysiwyg.ErrorBox','jsx')" + '?minify=false'
    };
    // END_VELOCITY

    //for (var path in PATHS) { PATHS[path] = PATHS[path].replace(/\.js$/, ''); }
    for (var path in PATHS) { PATHS[path] = PATHS[path] + '?cb='+(new Date()).getTime(); }
    require.config({paths:PATHS});

    if (!window.XWiki) {
        console.log("WARNING: XWiki js object not defined.");
        return;
    }

    // Not in edit mode?
    if (!DEMO_MODE && window.XWiki.contextaction !== 'edit') { return; }


    var getDocLock = function () {
        var force = document.querySelectorAll('a[href*="force=1"][href*="/edit/"]');
        return force.length? force[0] : false;
    };

    var usingCK = function () {
        var editor = window.XWiki.editor;
        // there are scripts for CKEditor which get loaded no matter what
        // this stylesheet only exists if you're using CKEditor to edit
        if (document.querySelectorAll('link[href*="CKEditor"]').length) {
            console.log("CKEditor detected, loading realtime WYSIWYG code...");
            return true;
        }
        //href='/xwiki/bin/ssx/CKEditor/EditSheet?language=en'
        //if (editor === 'inline') { return true; }
    };

    var pointToRealtime = function (link) {
        console.log("Presenting option to direct to CKEditor session: %s", href);
        var href = link.getAttribute('href').replace(/editor=(wiki|inline)[\&]?/, '') +
                'editor=inline&sheet=CKEditor.EditSheet&force=1';

        link.setAttribute('href', href);
        link.innerText = MESSAGES.joinSession;
    };

    var makeConfig = function () {
        var languageSelector = document.querySelectorAll('form input[name="language"]');// [0].value;

        var language = languageSelector[0] && languageSelector[0].value;

        if (!language || language === 'default') { language = DEFAULT_LANGUAGE; }

        // Username === <USER>-encoded(<PRETTY_USER>)%2d<random number>
        var userName = USER + '-' + encodeURIComponent(PRETTY_USER + '-').replace(/-/g, '%2d') +
            String(Math.random()).substring(2);

        return {
            websocketURL: WEBSOCKET_URL,
            userName: userName,
            language: language,
            channel: JSON.stringify([
                XWiki.currentWiki,
                XWiki.currentSpace,
                XWiki.currentPage,
                language,
                'rtwysiwyg'
            ])
        };
    };

    var checkSocket = function (config, callback) {
        var socket = new WebSocket(config.websocketURL);
        socket.onopen = function (evt) {
            var regMsgEnd = '3:[0]';
            socket.onmessage = function (evt) {
                if (evt.data.indexOf(regMsgEnd) !== evt.data.length - regMsgEnd.length) {
                    // not a register message (ignore it)
                } else if (evt.data.indexOf(config.userName.length + ':' + config.userName) === 0) {
                    // it's you registering
                    socket.close();
                    callback(false);
                } else {
                    socket.close();
                    callback(true);
                }
            };
            socket.send('1:x' +
                config.userName.length + ':' + config.userName +
                config.channel.length + ':' + config.channel +
                '3:[0]');
        };
    };

    var launchRealtime = function (config) {
        require(['jquery', 'RTWysiwyg_WebHome_realtime_wysiwyg'], function ($, RTWysiwyg) {
            if (RTWysiwyg && RTWysiwyg.main) {
                RTWysiwyg.main(config.websocketURL, config.userName, MESSAGES, config.channel, DEMO_MODE, config.language);
            } else {
                console.error("Couldn't find RTWysiwyg.main, aborting");
            }
        });
    };

    var realtimeDisallowed = function () {
        return localStorage.getItem(LOCALSTORAGE_DISALLOW)?  true: false;
    };
    var lock = getDocLock();

    var config = makeConfig();
    if (lock) {
        // found a lock link

        //console.log("Found a lock on the document!");
        checkSocket(config, function (active) {
            // determine if it's a realtime session
            if (active) {
                console.log("Found an active realtime");
                //launchRealtime(config);
                if (realtimeDisallowed()) {
                    // do nothing
                } else {
                    pointToRealtime(lock);
                }
            } else {
                console.log("Couldn't find an active realtime session");
            }
        });
    } else if (usingCK()) {
        // using CKEditor and realtime is allowed: start the realtime
        launchRealtime(config);
    } else {
        // do nothing
    }
}());
