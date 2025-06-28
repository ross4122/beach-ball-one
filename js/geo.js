function distanceInKm(originLatitude, originLongitude, destinationLatitude, destinationLongitude) {
    const R = 6371; // Radius of the earth in km
    const latitudeRad = deg2rad(destinationLatitude - originLatitude);
    const longitudeRad = deg2rad(destinationLongitude - originLongitude);
    const a =
        Math.sin(latitudeRad / 2) * Math.sin(latitudeRad / 2) +
        Math.cos(deg2rad(originLatitude)) * Math.cos(deg2rad(destinationLatitude)) *
        Math.sin(longitudeRad / 2) * Math.sin(longitudeRad / 2)
    ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

//-- Radius function
if (typeof (Number.prototype.toRad) === "undefined") {
    Number.prototype.toRad = function () {
        return this * Math.PI / 180;
    }
}

//-- Degrees function
if (typeof (Number.prototype.toDeg) === "undefined") {
    Number.prototype.toDeg = function () {
        return this * (180 / Math.PI);
    }
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}


function middlePoint(originLatitude, originLongitude, destinationLatitude, destinationLongitude) {

    const longitudeDifference = (destinationLongitude - originLongitude).toRad();

    const originLatitudeRad = originLatitude.toRad();
    const destinationLatitudeRad = destinationLatitude.toRad();
    const originLongitudeRad = originLongitude.toRad();

    const bX = Math.cos(destinationLatitudeRad) * Math.cos(longitudeDifference);
    const bY = Math.cos(destinationLatitudeRad) * Math.sin(longitudeDifference);
    const latitude = Math.atan2(Math.sin(originLongitudeRad) + Math.sin(destinationLatitudeRad),
        Math.sqrt((Math.cos(originLatitudeRad) + bX) * (Math.cos(originLatitudeRad) + bX) + bY * bY));
    const longitude = originLongitudeRad + Math.atan2(bY, Math.cos(originLatitudeRad) + bX);

    return {'Latitude': latitude.toDeg(), "Longitude": longitude.toDeg()};
}


function destinationPoint(originLatitude, originLongitude, bearing, kilometersFromOrigin) {
    kilometersFromOrigin = kilometersFromOrigin / 6371;
    bearing = bearing.toRad();

    const originLatitudeRad = originLatitude.toRad(), originLongitudeRad = originLongitude.toRad();

    const destinationLatitude = Math.asin(Math.sin(originLatitudeRad) * Math.cos(kilometersFromOrigin) +
        Math.cos(originLatitudeRad) * Math.sin(kilometersFromOrigin) * Math.cos(bearing));

    const destinationLongitude = originLongitudeRad + Math.atan2(Math.sin(bearing) * Math.sin(kilometersFromOrigin) *
        Math.cos(originLatitudeRad),
        Math.cos(kilometersFromOrigin) - Math.sin(originLatitudeRad) *
        Math.sin(destinationLatitude));

    if (isNaN(destinationLatitude) || isNaN(destinationLongitude)) {
        return null;
    }

    return {'Latitude': destinationLatitude.toDeg(), "Longitude": destinationLongitude.toDeg()};
}

function bearing(originLatitude, originLongitude, destinationLatitude, destinationLongitude) {
    const y = Math.sin(destinationLongitude.toRad() - originLongitude.toRad()) * Math.cos(destinationLatitude.toRad());
    const x = Math.cos(originLatitude.toRad()) * Math.sin(destinationLatitude.toRad()) -
        Math.sin(originLatitude.toRad()) * Math.cos(destinationLatitude.toRad()) * Math.cos(destinationLongitude.toRad() - originLongitude.toRad());
    const brng = Math.atan2(y, x);
    return (brng.toDeg() + 360) % 360;
}
