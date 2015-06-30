var animationFrames = 36;
var animationSpeed = 10; // ms
var canvas = document.getElementById('canvas');
var loggedInImage = document.getElementById('logged_in');
var canvasContext = canvas.getContext('2d');
var pollIntervalMin = 1;  // 1 minute
var pollIntervalMax = 60;  // 1 hour
var requestTimeout = 1000 * 5;  // 2 seconds
var rotation = 0;
var token;

function updateIcon() {
	if (localStorage.hasOwnProperty('hoursForCurrentPeriod')) {
		chrome.browserAction.setIcon({ path: "icon.png" });
		chrome.browserAction.setBadgeBackgroundColor({ color: [102, 102, 255, 255] });
		chrome.browserAction.setBadgeText({
			text: localStorage.hoursForCurrentDay != "0" ? localStorage.hoursForCurrentDay.split(":")[0] : ""
		});
	}
}

function scheduleRequest() {
	var randomness = Math.random() * 2;
	var exponent = Math.pow(2, localStorage.requestFailureCount || 0);
	var multiplier = Math.max(randomness * exponent, 1);
	var delay = Math.min(multiplier * pollIntervalMin, pollIntervalMax);
	delay = Math.round(delay);
	chrome.alarms.create('refresh', { periodInMinutes: delay });
}

function startRequest(params) {
	if (params && params.scheduleRequest) {
		scheduleRequest();
	};
	getTimeIntervals();
}

function getTimeIntervals() {
	var xhr = new XMLHttpRequest();
	function handleSuccess() {
		gethoursForCurrentPeriod(
			function (count) {
				updatehoursForCurrentPeriod(count);
			},
			function () {
				delete localStorage.hoursForCurrentPeriod;
				updateIcon();
			}
		)
	}
	function onError() {

	}
	var invokedErrorCallback = false;
	function handleError() {
		if (onError && !invokedErrorCallback)
			onError();
		invokedErrorCallback = true;
	}
	handleSuccess();	
}

function getPeriods() {

	var date = new Date();
	var currentPeriodStart;
	var currentPeriodEnd;
	var previousPeriodStart;
	var previousPeriodEnd;

	var currentDay = date.getDate();
	var str = "" + (+date.getMonth() + 1);
	var pad = "00"
	var currentMonth = pad.substring(0, pad.length - str.length) + str
	var currentYear = date.getFullYear();

	if (currentDay <= 15) {
		var previousMonth = date.getMonth() == 0 ? "12" : +date.getMonth();
		var lastDayPreviousMonth = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
		var previousPeriodEndYear = previousMonth == "12" ? date.getFullYear() - 1 : date.getFullYear();
		currentPeriodStart = date.getFullYear() + "-" + currentMonth + "-1";
		currentPeriodEnd = date.getFullYear() + "-" + currentMonth + "-15";
		previousPeriodStart = previousPeriodEndYear + "-" + previousMonth + "-16";
		previousPeriodEnd = previousPeriodEndYear + "-" + previousMonth + "-" + lastDayPreviousMonth;
	}
	else {
		var lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
		var currentYearAndMonth = currentYear + "-" + currentMonth;
		currentPeriodStart = currentYearAndMonth + "-16";
		currentPeriodEnd = currentYearAndMonth + "-" + lastDayOfMonth;
		previousPeriodStart = currentYearAndMonth + "-1";
		previousPeriodEnd = currentYearAndMonth + "-15";
	}
	return {
		'currentPeriodStart': currentPeriodStart + " 00:00:00",
		'currentPeriodEnd': currentPeriodEnd + " 23:59:59",
		'previousPeriodStart': previousPeriodStart + " 00:00:00",
		'previousPeriodEnd': previousPeriodEnd + " 23:59:59",
	};
}

function gethoursForCurrentPeriod(onSuccess, onError) {
	var xhr = new XMLHttpRequest();
	var abortTimerId = window.setTimeout(function () {
		xhr.abort();  // synchronously calls onreadystatechange
	}, requestTimeout);

	function handleSuccess(count) {
		localStorage.requestFailureCount = 0;
		window.clearTimeout(abortTimerId);
		if (onSuccess)
			onSuccess(count);
	}

	var invokedErrorCallback = false;
	function handleError() {
		++localStorage.requestFailureCount;
		window.clearTimeout(abortTimerId);
		if (onError && !invokedErrorCallback)
			onError();
		invokedErrorCallback = true;
	}

	try {
		chrome.cookies.get({ url: "https://fogbugz.com", name: "fbToken" }, function (cookie) {
			token = cookie.value;
		});
		xhr.onreadystatechange = function () {
			if (xhr.readyState != 4)
				return;

			if (xhr.responseXML) {
				var xmlDoc = xhr.responseXML;
				var resolver = xmlDoc.createNSResolver(xmlDoc.documentElement);
				var intervals = xmlDoc.getElementsByTagName("interval");
				if (intervals) {
					handleSuccess(intervals);
					return;
				} else {
					console.error(chrome.i18n.getMessage("error"));
				}
			}
			handleError();
		};
		xhr.onerror = function (error) {
			handleError();
		};
		
		var period = getPeriods();
		var prevStart =  new Date(period.previousPeriodStart), currEnd = new Date(period.currentPeriodEnd);
		localStorage.periodStart = new Date(period.currentPeriodStart);
		localStorage.periodEnd = currEnd;
		localStorage.previousPeriodStart = prevStart;
		localStorage.previousPeriodEnd = new Date(period.previousPeriodEnd);

		xhr.open("POST", "https://fogbugz.com/api.asp", true);
		xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		
		xhr.send("cmd=listIntervals&dtStart=" + prevStart.toISOString() + "&dtEnd=" + currEnd.toISOString() + "&cols=sProject&token=" + token);

	} catch (e) {
		console.error("failed to get intervals");
		handleError();
	}
}

function toHHMMSS(sec_num) {
	var hours = Math.floor(sec_num / 3600);
	var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
	var seconds = sec_num - (hours * 3600) - (minutes * 60);
	if (hours < 10) { hours = "0" + hours; }
	if (minutes < 10) { minutes = "0" + minutes; }
	if (seconds < 10) { seconds = "0" + seconds; }
	var time = hours + ':' + minutes;
	return time;
}

function dateFromUTC( dateAsString )
{
//Thanks to Peter Bailey http://stackoverflow.com/questions/1308720/javascript-wont-parse-gmt-date-time-format
  var pattern = new RegExp( "(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})" );
  var parts = dateAsString.match( pattern );

  return new Date( Date.UTC(
      parseInt( parts[1] )
    , parseInt( parts[2], 10 ) - 1
    , parseInt( parts[3], 10 )
    , parseInt( parts[4], 10 )
    , parseInt( parts[5], 10 )
    , parseInt( parts[6], 10 )
    , 0
  ));
}

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function getShortDate(date) {
	var intervalDate = new Date(date);
	return intervalDate.getFullYear() + "-" + (+intervalDate.getMonth() + 1) + "-" + intervalDate.getDate();
};

function getShortTime(date) {
	var intervalDate = new Date(date);
	if (intervalDate.getHours() <= 12) {
		return intervalDate.getHours() + ":" + pad(intervalDate.getMinutes(), 2) + " AM";
	}
	else {
		return (+intervalDate.getHours() - 12) + ":" + pad(intervalDate.getMinutes(), 2) + " PM";
	};
};

function compareForDescSort(a, b) {
	if (a.totalSeconds > b.totalSeconds)
		return -1;
	if (a.totalSeconds < b.totalSeconds)
		return 1;
	return 0;
}

function updatehoursForCurrentPeriod(intervals) {
	var secondsForPreviousInterval = 0;
	var intervalsForCurrentPeriod = [];
	var intervalsForPreviousPeriod = [];
	var periodStart = new Date(localStorage.periodStart);

	for (i = 0; i < intervals.length; i++) {
		var newInterval = {};
		newInterval.dtStart = dateFromUTC(intervals[i].getElementsByTagName("dtStart")[0].textContent);
		newInterval.dtEnd = intervals[i].getElementsByTagName("dtEnd")[0].textContent != '' ?
							   dateFromUTC(intervals[i].getElementsByTagName("dtEnd")[0].textContent) :
							   new Date();	 // if there's no dtEnd, the interval is in progress
		newInterval.title = intervals[i].getElementsByTagName("sTitle")[0].textContent;
		newInterval.totalSeconds = (newInterval.dtEnd.getTime() - newInterval.dtStart.getTime()) / 1000;
		newInterval.id = intervals[i].getElementsByTagName("ixBug")[0].textContent;
		userId = intervals[i].getElementsByTagName("ixPerson")[0].textContent;

		if (newInterval.dtEnd < periodStart) {
			intervalsForPreviousPeriod.push(newInterval);
			secondsForPreviousInterval += newInterval.totalSeconds;
		}
		else {
			intervalsForCurrentPeriod.push(newInterval);
		}
	}

	var distinctCases = [];
	for (i = 0; i < intervalsForCurrentPeriod.length; i++) {
		if (distinctCases.indexOf(intervalsForCurrentPeriod[i].id) == -1) {
			distinctCases.push(intervalsForCurrentPeriod[i].id);
		}
	}

	var distinctDates = [];
	var today = getShortDate(new Date())
	var timeLoggedForToday = false;
	for (i = 0; i < intervalsForCurrentPeriod.length; i++) {
		var intervalDate = getShortDate(intervalsForCurrentPeriod[i].dtEnd);
		if (distinctDates.indexOf(intervalDate) == -1) {
			distinctDates.push(intervalDate);
			if (intervalDate == today) {
				timeLoggedForToday = true;
			}
		}
	}

	var timeIntervalsForDate = [];
	var timeSummaryForDate = [];
	var totalSecondsForCurrentDay = 0;
	for (i = 0; i < distinctDates.length; i++) {
		var totalSecondsForCurrentDay = 0;
		var dtStartTimeForDate = '';
		var dtEndTimeForDate = '';
		var intervals = [];
		for (j = 0; j < intervalsForCurrentPeriod.length; j++) {
			if (getShortDate(intervalsForCurrentPeriod[j].dtEnd) == distinctDates[i]) {
				if (dtStartTimeForDate == '') dtStartTimeForDate = intervalsForCurrentPeriod[j].dtStart;
				dtEndTimeForDate = intervalsForCurrentPeriod[j].dtEnd;
				intervals.push({ 'dtStart': intervalsForCurrentPeriod[j].dtStart, 'dtEnd': intervalsForCurrentPeriod[j].dtEnd });
				totalSecondsForCurrentDay += intervalsForCurrentPeriod[j].totalSeconds;
			}
		}
		timeIntervalsForDate.push({ 'date': distinctDates[i], 'intervals': intervals });
		timeSummaryForDate.push({
			'date': distinctDates[i],
			'time': toHHMMSS(totalSecondsForCurrentDay),
			'startTime': getShortTime(new Date(dtStartTimeForDate)),
			'endTime': getShortTime(new Date(dtEndTimeForDate)),
		});
	};

	var intervalSummaryForCurrentPeriod = [];
	var totalSecondsInterval = 0;
	for (i = 0; i < distinctCases.length; i++) {
		var caseId = distinctCases[i];
		var totalSeconds = 0;
		var title = '';
		for (j = 0; j < intervalsForCurrentPeriod.length; j++) {
			if (intervalsForCurrentPeriod[j].id == distinctCases[i]) {
				totalSeconds += intervalsForCurrentPeriod[j].totalSeconds;
				title = intervalsForCurrentPeriod[j].title;
			}
		}
		totalSecondsInterval += totalSeconds;
		intervalSummaryForCurrentPeriod.push({ 'id': caseId, 'totalSeconds': totalSeconds, 'totalHours': toHHMMSS(totalSeconds), 'title': title });
	}
	intervalSummaryForCurrentPeriod.sort(compareForDescSort);

	localStorage.intervalsForPreviousPeriod = JSON.stringify(intervalsForPreviousPeriod);
	localStorage.intervalSummaryForCurrentPeriod = JSON.stringify(intervalSummaryForCurrentPeriod);
	localStorage.timeIntervalsForDate = JSON.stringify(timeIntervalsForDate);
	localStorage.timeSummaryForDate = JSON.stringify(timeSummaryForDate);
	localStorage.hoursForCurrentPeriod = toHHMMSS(totalSecondsInterval);
	localStorage.hoursForCurrentDay = timeLoggedForToday ? toHHMMSS(totalSecondsForCurrentDay) : "00:00"
	localStorage.hoursForPreviousPeriodAsDecimal = (secondsForPreviousInterval / (60 * 60)).toFixed(2);

	updateIcon();

}

function onInit() {
	localStorage.requestFailureCount = 0;  
	startRequest({ scheduleRequest: true });
	chrome.alarms.create('watchdog', { periodInMinutes: 5 });	
}

function onAlarm(alarm) {
	if (alarm && alarm.name == 'watchdog') {
		onWatchdog();
	} else {
		startRequest({ scheduleRequest: true });
	}
}

function onWatchdog() {
	chrome.alarms.get('refresh', function (alarm) {
		if (!alarm) {
			startRequest({ scheduleRequest: true });
		}
	});
}

(function () {
	chrome.cookies.get({ url: "https://fogbugz.com", name: "fbToken" }, function (cookie) {
		token = cookie.value;
	});

	chrome.alarms.onAlarm.addListener(onAlarm);
	chrome.runtime.onInstalled.addListener(onInit);

	chrome.runtime.onStartup.addListener(function () {
		startRequest({ scheduleRequest: false });
		updateIcon();
	});
}());
