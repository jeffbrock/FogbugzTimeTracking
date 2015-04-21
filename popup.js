function addCasesToView(intervalSummaryForCurrentPeriod, timeSummaryForDate) {
	var dtStart = new Date(localStorage.periodStart);
	var dtEnd = new Date(localStorage.periodEnd);
	var dtPreviousStart = new Date(localStorage.previousPeriodStart);
	var dtPreviousEnd = new Date(localStorage.previousPeriodEnd);

	$("#cases").html("");

	if (localStorage.hoursForCurrentPeriod == "00:00" && localStorage.hoursForPreviousPeriodAsDecimal == "0.00") {
		$("#cases").append("<div class='row' style='background-color:#BDDE5C'>Open a tab and log in to the <a target='_blank' href='https://altsource.fogbugz.com/'>FogBugz</a></div>");
		return;
	};
	$("#cases").append(
	"<div class='row' style='background-color:#BDDE5C'>" +

		"<strong>" +
			localStorage.hoursForCurrentPeriod +
		"</strong> - " +
		dtStart.toLocaleDateString() + " to " + dtEnd.toLocaleDateString() +
		"<div style='float:right;'>" +
			"<span><strong>" + localStorage.hoursForPreviousPeriodAsDecimal + "&nbsp;</strong></span>" +
			"<a id='rep' href=''>" +
				"(" + dtPreviousStart.toLocaleDateString() + " to " + dtPreviousEnd.toLocaleDateString() + ")" +
			"</a>" +
		"</div>" +
	"</div>");
	$("#cases").append(
	"<div class='row' style='background-color:#e5f2be'>" +
				"<strong>" +
			localStorage.hoursForCurrentDay +
		"</strong> - Today" +
	"</div>");
	$("#cases").append("<div class='row' style='background-color:#dfdfdf;'><strong><span id='daytotal'>(+)</span>&nbsp;Total by day</strong></row>");
	$.each(timeSummaryForDate, function (x, val) {
		var dt = new Date(val.date).toLocaleDateString();
		$("#cases").append("<div class='row byday' style='display:none;'>" + val.time +
			" - <a target='_blank' href='https://altsource.fogbugz.com/default.asp?pg=pgTimesheet&dt=" + dt + "' >" +
			dt + "</a>" + "  (" + val.startTime + " to " + val.endTime + ")</div>");
	});
	$("#cases").append("<div class='row' style='background-color:#dfdfdf;'><strong><span id='casetotal'>(+)</span>&nbsp;Total by case</strong></row>");
	$.each(intervalSummaryForCurrentPeriod, function (x, val) {
		$("#cases").append(
			"<div class='row bycase' style='display:none;'>" +
				val.totalHours + " - " +
				"<a target='_blank' href='https://altsource.fogbugz.com/default.asp?" + val.id + "' >[" + val.id + "]</a> " +
				val.title +
			"</div>");
	});
	
};

function downloadFileFromText(filename, content) {
	var a = document.createElement('a');
	var blob = new Blob([content], { type: "text/csv;charset=utf-8" });
	a.href = window.URL.createObjectURL(blob);
	a.download = filename;
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
};

function setupPreviousPeriodDownload() {
	document.getElementById('rep').addEventListener('click', function () {
		var dtStart = new Date(localStorage.previousPeriodStart);
		var dtEnd = new Date(localStorage.previousPeriodEnd);
		var filename = dtStart.getFullYear() + "_" + (+dtStart.getMonth() + 1) + "-" + dtStart.getDate() + "_" + (+dtEnd.getMonth() + 1) + "-" + dtEnd.getDate() + ".csv";
		var data = JSON.parse(localStorage.intervalsForPreviousPeriod);
		var csvContent = "Start,End,Duration (Min),Case,Title" + "\n";
		for (var i = 0; i < data.length; i++) {
			var dtStart = new Date(data[i].dtStart);
			var dtEnd = new Date(data[i].dtEnd);
			dataString =
				dtStart.toLocaleString().replace(/\,/g, "") + "," +
				dtEnd.toLocaleString().replace(/\,/g, "") + "," +
				(data[i].totalSeconds / 60).toFixed(2) + "," +
				data[i].id + "," +
				data[i].title;
			csvContent += dataString + "\n";
		};		
		downloadFileFromText(filename, csvContent);
	});
};

document.addEventListener('DOMContentLoaded', function() {	
	addCasesToView(JSON.parse(localStorage.intervalSummaryForCurrentPeriod), JSON.parse(localStorage.timeSummaryForDate));
	setupPreviousPeriodDownload();
	document.getElementById('daytotal').addEventListener('click', function () {
		$(".byday").show();
		$("#daytotal").html('');
	});
	document.getElementById('casetotal').addEventListener('click', function () {
		$(".bycase").show();
		$("#casetotal").html('');
	});
});

