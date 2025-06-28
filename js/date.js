function toLocalISOString(time) {

    if (time === null) {
        return '';
    }

    const tzo = -time.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function (num, lengthToPad = 2, paddingCharacter = '0') {
            let padded = '' + Math.floor(Math.abs(num));
            while (padded.length < lengthToPad) {
                padded = paddingCharacter + padded;
            }
            return padded;
        };

    return time.getFullYear() +
        '-' + pad(time.getMonth() + 1) +
        '-' + pad(time.getDate()) +
        'T' + pad(time.getHours()) +
        ':' + pad(time.getMinutes()) +
        ':' + pad(time.getSeconds()) +
        '.' + pad(time.getMilliseconds(), 3) +
        dif + pad(tzo / 60) +
        ':' + pad(tzo % 60);
}


function timestampToDate(timestamp) {
    if (timestamp == null || timestamp === '') {
        return null;
    }
    return new Date(parseInt(timestamp, 10));
}