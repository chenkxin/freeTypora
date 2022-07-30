require("Env.js");
var Dict = require("Dict.js"),
    electron = require("electron"),
    shell = electron.shell,
    app = electron.app,
    ipc = electron.ipcMain,
    BrowserWindow = electron.BrowserWindow,
    isWin = "win32" == process.platform,
    isMac = "darwin" == process.platform,
    isLinux = "linux" == process.platform,
    WindowController = require("WindowController.js"),
    Raven = require("raven"),
    errorShown = !1;
const mustRequire = function(e) { try { return require(e) } catch (e) { if (errorShown) return;
        errorShown = !0; var t = e.message;
        setTimeout(() => { errorShown = !1, dialog = require("electron").dialog, dialog.showMessageBox(null, { type: "error", buttons: ["OK"], defaultId: 0, cancelId: 0, title: "A required module cannot be loaded by Typora", message: t.split("\n")[0] + "\n\nPlease check if that file exists or reinstall Typora to fix." }).then(({ response: e }) => { process.exit(1) }) }, 1500) } };
var installDate, lastShown, hasLicense = null,
    email = "",
    licenseCode = "",
    fingerPrint = "";
const ActiveResponseCode = { SUCCESS: 0, OUT_OF_LIMIT: 1, INVALIDATE: -1, WRONG_USER: -2 },
    PUB_KEY = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7nVoGCHqIMJyqgALEUrc\n5JJhap0+HtJqzPE04pz4y+nrOmY7/12f3HvZyyoRsxKdXTZbO0wEHFIh0cRqsuaJ\nPyaOOPbA0BsalofIAY3mRhQQ3vSf+rn3g+w0S+udWmKV9DnmJlpWqizFajU4T/E4\n5ZgMNcXt3E1ips32rdbTR0Nnen9PVITvrbJ3l6CI2BFBImZQZ2P8N+LsqfJsqyVV\nwDkt3mHAVxV7FZbfYWG+8FDSuKQHaCmvgAtChx9hwl3J6RekkqDVa6GIV13D23LS\nqdk0Jb521wFJi/V6QAK6SLBiby5gYN6zQQ5RQpjXtR53MwzTdiAzGEuKdOtrY2Me\nDwIDAQAB\n-----END PUBLIC KEY-----\n\n",
    DAY_IN_MS = 864e5,
    HOST = "https://store.typora.io",
    decrypt = e => { if (!e) return e; var t; try { t = Buffer.from(e, "base64"); const n = require("crypto").publicDecrypt(PUB_KEY, t); return JSON.parse(n.toString("utf8")) } catch (e) { return null } },
    makeHash = function() { var e = Array.from(arguments); const t = require("crypto").createHash("sha256"); return e.forEach(e => { t.update(e) }), t.digest("base64") },
    readLicenseInfo = () => { const e = getLicenseLocalStore().get("SLicense"); if (!e) return null; const [t, n, i] = e.split("#"), a = decrypt(t); return a.fingerprint != fingerPrint ? null : (Object.assign(a, { failCounts: n, lastRetry: new Date(i) }), a) },
    writeInstallDate = async e => { console.log(`writeInstallDate fromBTime=${e}`); var t = new Date; if (e) try { var n = await require("fs-extra").stat(app.getPath("userData") + "/profile.data");
            t = new Date(n.birthtime), n.birthtime } catch (e) {} installDate = t; const i = t.toLocaleDateString("en-US"); return getLicenseLocalStore().put("IDate", i), installDate };
var licenseLocalStoreInstance = null;
const getLicenseLocalStore = function() { if (null == licenseLocalStoreInstance)
        if (isWin) licenseLocalStoreInstance = WindowsLicenseLocalStore();
        else { var e = app.setting.prepDatabase(fingerPrint);
            licenseLocalStoreInstance = { put: function(t, n) { console.log(`ls put ${t}`), e.getState()[t] = n, e.write() }, get: function(t) { return e.getState()[t] } } } return licenseLocalStoreInstance };

function WindowsLicenseLocalStore() { const e = mustRequire("native-reg"); return { get: function(t) { const n = e.openKey(e.HKCU, "Software\\Typora", e.Access.READ); if (null == n) return ""; const i = e.getValue(n, null, t); return e.closeKey(n), i }, put: function(t, n) { const i = e.createKey(e.HKCU, "Software\\Typora", e.Access.WRITE);
            e.setValueSZ(i, t, n), e.closeKey(i) } } }
const getFingerPrint = async () => { if (!fingerPrint) { if (isWin) { const e = mustRequire("native-reg"),
                t = e.openKey(e.HKEY.LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Cryptography", e.Access.WOW64_64KEY | e.Access.READ);
            fingerPrint = e.getValue(t, null, "MachineGuid"), e.closeKey(t) } else fingerPrint = await require("node-machine-id").machineId({ original: !0 });
        fingerPrint || (Raven.captureMessage("[testNodeLicense][fingerPrint]"), Raven.captureMessage("Failed to get fingerPrint", { extra: { method: "[testNodeLicense][fingerPrint]" } })), fingerPrint = makeHash(fingerPrint, "typora").substr(0, 10).replace(/[/=+-]/g, "a") } return fingerPrint };
var licenseInitialed = !1;
const watchLicense = async e => { firstValidateLicense(e), await validateTrail(), !global.betaVersion && console.log(`[watchLicense] hasLicense: ${hasLicense}`), showLicensePanelIfNeeded(), addToAnalysis() }, addToAnalysis = () => { var e = Raven.getContext().tags;
    e.hasLicense = hasLicense, Raven.mergeContext(e) }, getOS = () => process.platform.replace(/\d+/, ""), doRequest = async (e, t) => { const n = require("axios").post; try { var i = await n(`${HOST}/${e}`, t, { timeout: 3e4 }) } catch (s) { s.stack; var a = s; if (s.response) throw s; try { i = await n(`https://typora.io/store/${e}`, t, { timeout: 4e4 }) } catch (e) { throw a } } return i }, renewLicense = async (e, t) => { const n = (new Date).toLocaleDateString("en-US"); const { deviceId: i, lastRetry: a } = e || {}; if (!t && new Date - a < 432e5) return; const s = { v: getOS() + "|" + app.getVersion(), license: licenseCode, l: i, u: app.setting.generateUUID(), type: global.devVersion ? "dev" : "" };
    JSON.stringify(s); try { const e = await require("axios").post(`${HOST}/api/client/renew`, s, { timeout: 4e4 });
        JSON.stringify(e.data), e.data.success || (console.warn("[renewLicense]: unfillLicense due to renew fail"), unfillLicense(e.data.msg)), getLicenseLocalStore().put("SLicense", [e.data.msg, 0, n].join("#")) } catch (e) { e.stack, Raven.captureException(e, { level: "warning" }), console.warn("Failed to Renew License"),
            function() { var e = getLicenseLocalStore().get("SLicense"),
                    [t, i, a] = e.split("#");
                e = [t, i = i - 0 + 1, n].join("#"), getLicenseLocalStore().put("SLicense", e) }() } }, getInstallDate = e => { var t = new Date(getLicenseLocalStore().get("IDate")); if (isNaN(t.getTime())) return e ? null : new Date; if (e) return t; var n = 7964342400000; return isNaN(n) ? n = new Date("2021-10-01") : (n = new Date(n), isNaN(n.getTime()) && (n = new Date("2021-10-01"))), t < n ? n : t }, getTrailRemains = (e, t) => { t = t || 15; var n = Math.floor((new Date - installDate) / 864e5),
        i = Math.max(0, t - n); return e && (i > t || isNaN(i)) && (i = t), i }, validateTrail = async () => { var e = (installDate = getInstallDate(!global.devVersion)) ? getTrailRemains(!1) : 100;
    (e > 15 || isNaN(e)) && (console.log("[validateTrail] Read from incorrupted InstallDate"), await writeInstallDate(!0), e = 15), console.log(`[validateTrail] installDate is ${installDate.toLocaleDateString("en-US")}, trail remains: ${e} days`) };

function fillLicense(e, t) { licenseCode = t, (hasLicense = !(!(email = e) || !licenseCode)) && onFillLicense() }

function unfillLicense(e) { hasLicense || (e = ""), email = "", licenseCode = "", hasLicense = !1, getLicenseLocalStore().put("SLicense", ""), e && showDialog(Dict.getPanelString("Typora is now deactivated"), Dict.getPanelString(e)), onUnfillLicense() }
const firstValidateLicense = e => { licenseInitialed = !0; const t = readLicenseInfo(),
            { license: n, email: i } = t || {};
        n && i ? (fillLicense(i, n), renewLicense(t, e)) : unfillLicense() },
    showDialog = (e, t) => electron.dialog.showMessageBox(null, { type: "error", buttons: ["OK"], defaultId: 0, cancelId: 0, title: e, message: t }),
    endDevTest = function() { app.expired = !0, showDialog(Dict.getPanelString("Error"), Dict.getPanelString("This beta version of Typora is expired, please download and install a newer version.")).then(() => { shell.openExternal("https://typora.io/#download"), setTimeout(() => { process.exit(1) }, 1e3) }) },
    validateDevTest = function() { if (!hasLicense && !isLinux && global.devVersion && global.PRODUCTION_MODE) { var e = getInstallDate(),
                t = new Date;
            console.log("buildTime is 7964342400000"), (isNaN(7964342400000) || t - 7964342400000 > 20736e6) && endDevTest(), e -= 0, console.log("verInitTime is " + e), !isNaN(e) && t - e > 1728e7 && endDevTest() } },
    showLicensePanelIfNeeded = function() { shouldShowNoLicenseHint(!0) && !app.setting.inFirstShow && (isLinux && Math.random() < .95 || (!lastShown || new Date - lastShown > 18e6 || getTrailRemains(!0, 30) <= 0) && showLicensePanel()) };
var licensePanel = null;
const showLicensePanel = async function(e) { if (lastShown = new Date, null == licensePanel) return (licensePanel = WindowController.showPanelWindow({ width: 525, height: 420, path: `page-dist/license.html?dayRemains=${getTrailRemains(!0)}&index=${e?1:0}\n\t\t\t\t&hasActivated=${hasLicense||!1}&email=${email}&license=${licenseCode}&lang=${app.setting.getUserLocale()}&needLicense=${shouldShowNoLicenseHint()}`, frame: !1, alwaysOnTop: !errorShown })).on("closed", function() { licensePanel = null }), void setTimeout(() => { licensePanel && !licensePanel.isDestroyed() && licensePanel.setAlwaysOnTop(!1) }, 5e3);
    licensePanel.focus() };
var welcomePanel = null;
const showWelcomePanel = async function() { if (lastShown = new Date, null == welcomePanel) return (welcomePanel = WindowController.showPanelWindow({ width: 760, height: 460, path: `page-dist/welcome.html?lang=${app.setting.getUserLocale()}`, frame: !1, alwaysOnTop: !errorShown })).on("closed", function() { welcomePanel = null }), void setTimeout(() => { welcomePanel && !welcomePanel.isDestroyed() && welcomePanel.setAlwaysOnTop(!1) }, 8e3);
    welcomePanel.focus() }, quickValidate = e => { const t = "L23456789ABCDEFGHJKMNPQRSTUVWXYZ"; if (!/^([A-Z0-9]{6}-){3}[A-Z0-9]{6}$/.exec(e)) return !1; var n = e.replace(/-/g, ""),
        i = n.substr(22); return !n.replace(/[L23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, "") && i == (e => { for (var n = "", i = 0; i < 2; i++) { for (var a = 0, s = 0; s < 16; s += 2) a += t.indexOf(e[i + s]);
            n += t[a %= t.length] } return n })(n) }, getComputerName = async function() { var e = process.env.USER; switch (e || (e = require("os").userInfo().username), process.platform) {
        case "win32":
            return process.env.COMPUTERNAME + " | " + e + " | Windows";
        case "darwin":
            return new Promise(t => { require("child_process").exec("scutil --get ComputerName", { timeout: 5e3 }, (n, i) => { t(!n && i ? i.toString().trim() + " | " + e + " | darwin" : require("os").hostname() + " | " + e + " | darwin") }) });
        default:
            return require("os").hostname() + " | " + e + " | Linux" } }, doActivation = async function(e, t) { if (! function(e) { return /^[^\s@'"/\\=?]+@[^\s@'"/\\]+\.[^\s@'"/\\]+$/.test(e) }(e)) return [!1, "Please input a valid email address"]; if (!quickValidate(t)) return [!1, "Please input a valid license code"]; const n = { v: getOS() + "|" + app.getVersion(), license: t, email: e, l: await getComputerName(), f: await getFingerPrint(), u: app.setting.generateUUID(), type: global.devVersion ? "dev" : "" };
    JSON.stringify(n); try { const e = await doRequest("api/client/activate", n); if (JSON.stringify(e.data), e.data.code == ActiveResponseCode.SUCCESS) return await writeActivationInfo(e.data.msg) ? [!0, ""] : [!1, "Please input a valid license code"]; if (e.data.code == ActiveResponseCode.OUT_OF_LIMIT) return await writeActivationInfo(e.data.msg) ? [!0, "Your license has exceeded the max devices numbers.\nThe oldest device was unregistered automatically."] : [!1, "Please input a valid license code"]; if (e.data.code == ActiveResponseCode.INVALIDATE) return [!1, "Please input a valid license code"]; if (e.data.code == ActiveResponseCode.WRONG_USER) return [!1, "The license has been used with a different email address."] } catch (e) { return e.response && e.response.code ? [!1, "Unknown Error. Please contact hi@typora.io"] : (Raven.captureException(e, { level: "warning" }), console.error(e.stack), [!1, "Failed to access the license server. Please check your network or try gain later."]) } }, writeActivationInfo = async function(e) { const t = decrypt(e) || {},
        { deviceId: n, fingerprint: i, email: a, license: s, version: o, date: r } = t; return i == await getFingerPrint() && a && s ? (fillLicense(a, s), getLicenseLocalStore().put("SLicense", `${e}#0#${(new Date).toLocaleDateString("en-US")}`), hasLicense = !0, !0) : (console.log("validate server return fail"), unfillLicense(), !1) }, doDeactivation = async () => { hasLicense && email && licenseCode || console.error("doDeactivation on unregistered device"); const { deviceId: e } = readLicenseInfo() || {}; try { await require("axios").post(`${HOST}/api/client/deactivate`, { license: licenseCode, l: e, sig: makeHash(email, await getFingerPrint(), licenseCode) }, { timeout: 4e4 }) } catch (e) { Raven.captureException(e, { level: "warning" }), console.log(e.stack) } unfillLicense() };
async function testNodeLicense() { try { if (!decrypt("P5knTvbkrWrFbz+UjU/oeOckjIteVUOuVixSMzpBQTPDG+iIp4PbnTZWYzqmmJSTOwM0PdQ7ySMeSN6lUQkHZoRdqdZu7kpniCr9sYbDkfcjeZL1bNCxXR6admWsY3J7Vz5z7BzCwwdu0z8WFeKuEzn/a14jDDlwi7jIc3yhLSBU/T4kbqOhqhSQKfJfwFKRsJ2uJDIGCNYh2/sllzwiTLFGbWmGyxFyCLxZ6wKw2J3OxTq6iP5iU4/Jt4Dsl8Oaf1irnAhyWvvXFvAQnK+7n3bGoXFidHcdHDb3oje0QMI9COOVXh+1AhApnZRMp7UhXJdxiovVPFj8U07s8DrJ6Q==")) throw new Error("decrypt get empty") } catch (e) { Raven.captureMessage("[testNodeLicense][decrypt]"), Raven.captureException(e, { extra: { method: "[testNodeLicense][decrypt]" } }) } try { await getFingerPrint() } catch (e) { Raven.captureMessage("[testNodeLicense][getFingerPrint]"), Raven.captureException(e, { extra: { method: "[testNodeLicense][getFingerPrint]" } }) } try { makeHash("123456") } catch (e) { Raven.captureMessage("[testNodeLicense][makeHash]"), Raven.captureException(e, { extra: { method: "[testNodeLicense][makeHash]" } }) } } ipc.handle("addLicense", async (e, { email: t, license: n }) => { try { return await doActivation(t, n) } catch (e) { console.error(e.stack) } }), ipc.handle("license.show", (e, t) => { showLicensePanel(t || !1) }), ipc.handle("removeLicense", async e => { try { return await doDeactivation() } catch (e) { console.error(e.stack) } });
const start = async (e, t) => { testNodeLicense(), console.log(`start LM in devVersion=${global.devVersion}`); try { await getFingerPrint(), !e && t || isLinux || (global.devVersion || !t || t.indexOf("dev") > -1) && (console.log("re-write InstallDate"), await writeInstallDate()), validateDevTest(), watchLicense(e) } catch (e) { Raven.captureException(e) } }, shouldShowNoLicenseHint = e => !hasLicense && (e || !isLinux) && !global.devVersion, getHasLicense = () => hasLicense, appendLicenseHintIfNeeded = e => { licenseInitialed && shouldShowNoLicenseHint() && onUnfillLicense(e) };

function genClassName() { var e = (new Date).getTime(); return "txxxx-xxxx-xxxxy".replace(/[x]/g, function(t) { var n = (e + 16 * Math.random()) % 16 | 0; return e = Math.floor(e / 16), n.toString(16) }) }
const className = genClassName(),
    onFillLicense = () => { BrowserWindow.getAllWindows().forEach(e => { e.webContents.executeJavaScript(`try{document.querySelector(".${className}").remove();}catch(e){};File.option && (File.option.hasLicense = true);File.megaMenu && File.megaMenu.forceReload();0;`) }) },
    onUnfillLicense = async e => { if (isLinux || global.devVersion) return;
        await Dict.init(); const t = `.typora-sourceview-on .${className}{\n\t\tdisplay:none;\n\t}\n\t.${className} {\n\t\tposition: fixed;\n    bottom: 2px;\n    z-index: 9999;\n    left: 70px;\n    font-size: 12px;\n    line-height: 24px;\n    background: rgb(120 120 120 / 30%);\n    padding: 0 12px;\n    color: var(--text-color);\n    border-radius: 4px;\n    cursor: pointer;\n\t}\n\t.pin-outline .${className}{\n\t\tleft:calc(var(--sidebar-width) + 70px);\n\t}`,
            n = `if(window.File.option){\n\t\tFile.option.hasLicense = false; \n\t\tFile.megaMenu && File.megaMenu.forceReload();\n\t\tif(!document.querySelector(".${className}")) {\n\t\t\tconst pos = Math.round(Math.random() * document.body.children.length);\n\t\t\tconst dom = document.createElement("DIV");\n\t\t\tdom.innerText = "${Dict.getPanelString("UNREGISTERED")} ×";\n\t\t\tdom.classList.add("${className}");\n\t\t\tdom.style = "position: fixed !important;bottom: 2px !important; display: block !important; opacity: 1 !important; height: auto !important; width: auto !important; z-index: 9999 !important;"\n\t\t\tdom.setAttribute("role", "button");\n\t\t\tdom.addEventListener("click", () => {\n\t\t\t\tdom.remove();\n\t\t\t\treqnode("electron").ipcRenderer.invoke("license.show");\n\t\t\t});\n\t\t\tdocument.body.insertBefore(dom, document.body.children[pos]);\n\t\t}\n\t};1;`;

        function i(e) { e.webContents.insertCSS(t), e.webContents.executeJavaScript(n) } e ? i(e) : BrowserWindow.getAllWindows().forEach(i) };
exports.shouldShowNoLicenseHint = shouldShowNoLicenseHint, exports.start = start, exports.showLicensePanel = showLicensePanel, exports.showWelcomePanel = showWelcomePanel, exports.appendLicenseHintIfNeeded = appendLicenseHintIfNeeded, exports.getHasLicense = getHasLicense, exports.showLicensePanelIfNeeded = showLicensePanelIfNeeded;