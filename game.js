"use strict";

// game
var satpic = document.getElementById("satpic");
var ctx = satpic.getContext("2d");
var nextbtn = document.getElementById("nextbtn");
var submitbtn = document.getElementById("submitbtn");
var setZoom = document.getElementById("setZoom");
var zoomval = document.getElementById("zoomval");
var setSpeed = document.getElementById("setSpeed");
var speedval = document.getElementById("speedval");
var setMap = document.getElementById("setMap");

var currentLat = 0;
var currentLng = 0;
var currentGuess = undefined;
var ans = undefined;

// set up map
var map = L.map('map', {
    center: [0,0],
    zoom: 1,
    worldCopyJump: true,
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.on("click", function(e) {
    if (currentGuess === undefined) {
        currentGuess = L.marker(e.latlng, {
            draggable: true,
            autoPan: true
        }).addTo(map);
    } else {
        currentGuess.setLatLng(e.latlng);
    }
    submitbtn.disabled = false;
});

submitbtn.onclick = function() {
    submitbtn.disabled = true;

    if (ans !== undefined) {
        ans.removeFrom(map);
        ans = undefined;
    }
    ans = L.marker([currentLat, currentLng]).addTo(map);
    let pos = currentGuess.getLatLng();
    let delta_lat = Math.abs(currentLat - pos.lat);
    let delta_lng = Math.abs(currentLng - pos.lng);

    while (delta_lng > 180) {
        console.log("here");
        delta_lng -= 180;
    }

    let delta = Math.sqrt((delta_lat * delta_lat)+(delta_lng * delta_lng));

    ans.bindPopup("You were off by "+ delta +" degrees squared").openPopup();
}

setZoom.onchange = function() {
    zoomval.innerText = setZoom.value;
};
setSpeed.onchange = function() {
    speedval.innerText = setSpeed.value;
}

var maps = [
    {
        name: "Landsat_WELD_CorrectedReflectance_TrueColor_Global_Monthly",
        title: "Monthly Reflectance",
        west: -180,
        east: 180,
        south: -90,
        north: 90,
        start: new Date("1998-12-01"),
        end: new Date("2001-11-01"),
        per: 1,
        perunit: "M"
    }
];

var toset = 0;
function updateselect() {
    // clear
    while (setMap.length > 0) {
        setMap.remove(0);
    }
    // add
    for (let i = 0; i < maps.length; i++) {
        let option = document.createElement("option");
        option.text = maps[i].title;
        option.value = i;
        setMap.add(option);
    }

    // move the choice to where it is in the value
    setMap.value = toset;
}

var images = [];
var loaded = 0;

var prevts = 0;
var imgind = 0;
function imgdisp(ts) {
    if (images.length == 0) {
        window.requestAnimationFrame(imgdisp);
        return;
    }

    if (imgind >= images.length) {
        imgind = 0;
    } else if (imgind < 0) {
        imgind = images.length - 1;
    }

    var sv = setSpeed.value;

    // display image
    var img = images[imgind];
    if (img.loadedandready) {
        ctx.drawImage(images[imgind], 0, 0);
    } else {
        if (sv > 0.0) {
            imgind += 1;
        } else {
            imgind -= 1;
        }
        window.requestAnimationFrame(imgdisp);
        return;
    }

    //TODO draw center spot

    var dt = ts - prevts;
    if ((sv != 0) && (dt > 300/Math.abs(sv))) {
        prevts = ts;
        if (sv > 0.0) {
            imgind += 1;
        } else if (sv < 0.0) {
            imgind -= 1;
        }
    }
    window.requestAnimationFrame(imgdisp);
}

function getGameForLatLong(m, lat, long) {
    var h = satpic.height;
    var w = satpic.width;
    var zoom = Number(setZoom.value);
    var wzoom = zoom * w / h;

    currentLat = lat;
    currentLng = long;
    if (currentGuess !== undefined) {
        currentGuess.removeFrom(map);
        currentGuess = undefined;
        submitbtn.disabled = true;
    }
    if (ans !== undefined) {
        ans.removeFrom(map);
        ans = undefined;
    }
    
    // box bottom, left, top, right
    // box south, west, north, east
    var box = [
        lat - zoom,
        long - wzoom,
        lat + zoom,
        long + wzoom
    ];

    var rou = 100;
    box[0] = Math.round(rou * box[0]) / rou;
    box[1] = Math.round(rou * box[1]) / rou;
    box[2] = Math.round(rou * box[2]) / rou;
    box[3] = Math.round(rou * box[3]) / rou;

    var url = "http://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?";
    url += "SERVICE=WMS&";
    url += "REQUEST=GetMap&";
    url += "VERSTION=1.3.0&";
    url += "FORMAT=image%2Fpng&";
    url += "TRANSPARENT=false&";
    url += "CRS=EPSG:4326&";
    url += "HEIGHT="+ h +"&";
    url += "WIDTH="+ w +"&";
    url += "LAYERS="+ m.name + "&";
    url += "BBOX="+ box[0] +","+ box[1] +","+ box[2] +","+ box[3] +"&";

    console.log(url);

    images = [];
    loaded = 0;

    var t = new Date(m.start);
    while (t <= m.end) {
        let imgurl = url + "TIME=" + t.toISOString().split('T')[0];
        
        let img = new Image();
        images.push(img);
        img.loadedandready = false;
        img.onload = function() {
            img.loadedandready = true;
            loaded += 1;
        }
        img.src = imgurl;

        if (m.perunit == "D") {
            t.setDate(t.getDate() + m.per);
        } else if (m.perunit == "M") {
            t.setMonth(t.getMonth() + m.per);
        } else {
            t.setFullYear(t.getFullYear() + m.per);
        }
    }
}

var geopoints = [];
function getLatLongInMap(m, callback) {

    if (geopoints.length == 0) {
        // get the json and parse it
        let x = new XMLHttpRequest();
        x.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                let json = JSON.parse(this.responseText);
                //debugger;
                for (let i = 0; i < json.features.length; i++) {
                    let g = json.features[i].geometry.coordinates;
                    while (isNaN(g[0][0])) {
                        g = g.flat();
                    }
                    geopoints = geopoints.concat(g);
                }
                if (geopoints.length > 0) {
                    getLatLongInMap(m, callback);
                } else {
                    alert("Error parsing geojson")
                }
            }
        }
        x.open("GET", "./TM_WORLD_BORDERS_SIMPL-0.3.geojson", true);
        x.send();

        return;
    }

    var lat = 0;
    var long = 0;

    // find geopoint in map area
    let randoff = Math.ceil(Math.random() * geopoints.length);
    for (let i = 0; i < geopoints.length; i++) {
        let ind = (i + randoff) % geopoints.length;

        if (geopoints[ind][1] > m.north || geopoints[ind][1] < m.south) {
            continue;
        }
        if (geopoints[ind][0] > m.east || geopoints[ind][0] < m.west) {
            continue;
        }

        callback(m, geopoints[ind][1], geopoints[ind][0]);
        return;
    }

    console.log("No suitable point in set!");

    // couldn't find a point in our set, use a random one
    lat = (Math.random() * (m.north - m.south)) + m.south;
    long = (Math.random() * (m.east - m.west)) + m.west;

    callback(m, lat, long);
    return;
}

function nextGame() {
    // get random position for the map
    //TODO find somewhere with coast, rivers, or lakes?
    //TODO get an even distribution geographically?
    
    var m = maps[setMap.value];
    getLatLongInMap(m, getGameForLatLong);
}
nextbtn.onclick = nextGame;

function getMapInfo() {
    //TODO
    //https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0
    let x = new XMLHttpRequest();
    x.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            console.log("Got Data for Maps");
            var xdoc = this.responseXML;
            var layers = xdoc.getElementsByTagName("Layer");
            for (let i = 0; i < layers.length; i++) {
                if (layers[i].getAttribute("queryable") == null) {
                    continue;
                }
                let l = layers[i];

                let name;
                let title;
                let west;
                let east;
                let south;
                let north;
                let start = new Date();
                let end = start;
                let per = 1;
                let perunit = "Y";

                for (let j = 0; j < l.children.length; j++) {
                    let tag = l.children[j];
                    if (tag.tagName == "Name") {
                        name = tag.innerHTML;
                    } else if (tag.tagName == "Title") {
                        title = tag.innerHTML;
                    } else if (tag.tagName == "BoundingBox") {
                        north = Number(tag.getAttribute("maxx"));
                        south = Number(tag.getAttribute("minx"));
                        east = Number(tag.getAttribute("maxy"));
                        west = Number(tag.getAttribute("miny"));
                    } else if (tag.tagName == "Dimension") {
                        let sl = tag.innerHTML.split(',');
                        sl = sl[sl.length-1].split('/');
                        if (sl.length >= 3) {
                            start = new Date(sl[0]);
                            end = new Date(sl[1]);
                            let perinfo = sl[2];
                            per = perinfo.substring(1, perinfo.length-1);
                            perunit = perinfo[perinfo.length-1];
                        }
                    }
                }

                // filter

                if (name != undefined &&
                    title != undefined &&
                    west != undefined &&
                    east != undefined &&
                    south != undefined &&
                    north != undefined
                ) {
                    if (name.includes("Reflect") ||
                        name.includes("Color") ||
                        name.includes("True") ||
                        name.includes("Marble")) {
                        // add to maps
                        maps.push({
                            name: name,
                            title: title,
                            west: west,
                            east: east,
                            south: south,
                            north: north,
                            start: start,
                            end: end,
                            per: per,
                            perunit: perunit
                        });

                        if (name == "MODIS_Aqua_CorrectedReflectance_TrueColor") {
                            // my favorite
                            toset = "" + (maps.length - 1);
                        }
                    }
                }
            }

            updateselect();
        }
    }
    x.open("GET", "http://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0", true);
    x.send();
}


//TODO add interaction

// let things loose
updateselect();
getMapInfo();
nextGame();
window.requestAnimationFrame(imgdisp);