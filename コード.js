// ========= Code.gs =========

function doGet(e) {
  const view = e.parameter.view || "form";
  if (view === "admin") {
    return HtmlService.createHtmlOutputFromFile("admin");
  } else if (view === "individual") {
    return HtmlService.createHtmlOutputFromFile("individual");
  } else {
    return HtmlService.createHtmlOutputFromFile("form");
  }
}

function getOptionsFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("options");
  const values = sheet.getDataRange().getValues();
  let optionsMap = {};

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const key = row[0];
    const choices = row.slice(1).filter(v => v !== "");
    optionsMap[key] = choices;
  }

  return optionsMap;
}

function submitForm(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("responses");
  const headers = sheet.getRange(1, 3, 1, sheet.getLastColumn() - 2).getValues()[0];
  const row = [new Date(), data["モード"] || ""];

  for (let i = 0; i < headers.length; i++) {
    row.push(data[headers[i]] || "");
  }

  const messageIndex = headers.indexOf("AIメッセージ");
  const cocolog = data["きょうのココログ"] || data["そのために何する？"] || "";
  if (messageIndex !== -1 && cocolog) {
    try {
      const reply = getLLMReply(cocolog);
      row[messageIndex + 2] = reply;
    } catch (e) {
      Logger.log("AIメッセージ生成失敗: " + e.message);
    }
  }

  sheet.appendRow(row);
}

function getTodaySubmissions() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("responses");
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const header = data[0];
  const nameIndex = header.indexOf("氏名");
  if (nameIndex === -1) return [];

  const today = new Date();
  const yyyyMMdd = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

  return data.filter((row, index) => {
    if (index === 0) return false;
    const rowDate = new Date(row[0]);
    const rowDateStr = `${rowDate.getFullYear()}/${rowDate.getMonth() + 1}/${rowDate.getDate()}`;
    return rowDateStr === yyyyMMdd;
  }).map(row => {
    return {
      時間: new Date(row[0]).toLocaleTimeString(),
      モード: row[1],
      氏名: row[nameIndex] || "(未記入)"
    };
  });
}

function getResponsesByName(name) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("responses");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];

    const nameIndex = headers.indexOf("氏名");
    if (nameIndex === -1) {
      Logger.log("氏名の列が見つかりません");
      return [];
    }

    const trimmedTarget = name.trim();
    Logger.log("検索対象の名前: '" + trimmedTarget + "'");

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const studentName = (row[nameIndex] || "").toString().trim();

      if (studentName === trimmedTarget) {
        const rowObj = {};
        headers.forEach((h, j) => {
          rowObj[h] = (row[j] instanceof Date)
            ? Utilities.formatDate(row[j], Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss")
            : row[j]?.toString?.() ?? "";
        });
        results.push(rowObj);
      }
    }

    Logger.log("ヒット件数: " + results.length);
    return results.reverse();
  } catch (e) {
    Logger.log("getResponsesByName エラー: " + e.toString());
    return null;
  }
}

function getLatestPostByStudents() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("responses");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameIndex = headers.indexOf("氏名");

  const records = {};

  for (let i = data.length - 1; i > 0; i--) {
    const row = data[i];
    const name = (row[nameIndex] || "").toString().trim();
    if (!records[name]) {
      const obj = {};
      headers.forEach((h, j) => {
        obj[h] = (row[j] instanceof Date)
          ? Utilities.formatDate(row[j], Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss")
          : row[j]?.toString?.() ?? "";
      });
      records[name] = obj;
    }
  }

  return Object.values(records);
}

function getMyEmail() {
  return Session.getActiveUser().getEmail();
}

function getStudentList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("students");
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  return values.map(row => ({ name: row[1], email: row[2] }));
}

function getAdminList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("admins");
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return values.map(row => ({ name: row[0], email: row[1] }));
}

function getTodayZoneSummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("responses");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const zoneIndex = headers.indexOf("心のゾーンは？");
  const dateIndex = headers.indexOf("タイムスタンプ");

  const summary = {};
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDate = Utilities.formatDate(new Date(row[dateIndex]), Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (rowDate === today) {
      const zone = row[zoneIndex];
      if (zone) {
        summary[zone] = (summary[zone] || 0) + 1;
      }
    }
  }
  return summary;
}

function getLLMReply(text) {
  const apiKey = 'OPENAI_APIKEY';
  const url = 'https://api.openai.com/v1/chat/completions';

  const prompt = `以下は中学生が書いた記録です。この子が前向きな気持ちになれるような、やさしく応援するメッセージを50文字程度で送ってください。また，どのような行動を取るかを具体的に測定や観測可能な形で示せるように促してください\n\n「${text}」`;

  const payload = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'あなたは生徒の気持ちを大切にする担任の先生です。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  return json.choices[0].message.content.trim();
}

function getRecentLogs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("responses");
  const data = sheet.getDataRange().getValues();
  return data.slice(1).reverse().slice(0, 10);
}

function saveTeacherComment(timestampStr, comment) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("responses");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const indexTimestamp = headers.indexOf("タイムスタンプ");
  let indexComment = headers.indexOf("先生コメント");

  if (indexTimestamp === -1) return false;

  if (indexComment === -1) {
    indexComment = headers.length;
    sheet.getRange(1, indexComment + 1).setValue("先生コメント");
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cellTimestamp = row[indexTimestamp];

    const formatted = cellTimestamp instanceof Date
      ? Utilities.formatDate(cellTimestamp, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss")
      : cellTimestamp?.toString?.().trim();

    if (formatted === timestampStr.trim()) {
      sheet.getRange(i + 1, indexComment + 1).setValue(comment);
      return true;
    }
  }
  return false;
}

function getPersonalStatsByPeriod(name, period) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("responses");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameIndex = headers.indexOf("氏名");
  const energyIndex = headers.indexOf("心のエネルギーは？");
  const zoneIndex = headers.indexOf("心のゾーンは？");
  const cocologIndex = headers.indexOf("きょうのココログ");
  const whatToDoIndex = headers.indexOf("そのために何する？");
  const dateIndex = headers.indexOf("タイムスタンプ");
  const modeIndex = headers.indexOf("モード");

  const now = new Date();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[nameIndex] !== name) continue;
    if (row[modeIndex] !== 'morning') continue;

    const date = new Date(row[dateIndex]);
    if (!(date instanceof Date) || isNaN(date.getTime())) continue;

    const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy/MM/dd");

    let include = false;
    if (period === 'day') {
      include = isSameDay(date, now);
    } else if (period === 'week') {
      include = isSameWeek(date, now);
    } else if (period === 'month') {
      include = isSameMonth(date, now);
    }

    if (include) {
      result.push({
        日付: dateStr,
        "心のエネルギー": parseInt(row[energyIndex]) || 0,
        "心のゾーンは？": row[zoneIndex] || "",
        ココログ: row[cocologIndex] || "",
        "そのために何する？": row[whatToDoIndex] || ""
      });
    }
  }

  Logger.log("こころの記録（個人ビュー）を更新した後のデータ件数: " + result.length);
  return result;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function isSameWeek(date1, date2) {
  const startOfWeek = new Date(date2);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  return date1 >= startOfWeek && date1 <= endOfWeek;
}

function isSameMonth(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth();
}
