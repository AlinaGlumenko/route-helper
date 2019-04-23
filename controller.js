// Add your access token MapBox
mapboxgl.accessToken = 'yourkey';
// Center of map at start
var center = [30.729, 46.4747];
// My pointList
var pointList = [];
// My MarkerList
var markerList = {};
// Declare 'dropoffs' for MapBox
var dropoffs = turf.featureCollection([]);
// Declare 'pointListElement'
var pointListElement = document.getElementById('pointList');
// Adding listener for 'pointListElement'
pointListElement.addEventListener("mouseout", changeOrder);
// Create an empty GeoJSON feature collection, which will be used as the data source for the route before users add any new data
var nothing = turf.featureCollection([]);


// Initialize a map
var map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/light-v10', // stylesheet location
    center: center, // starting position
    zoom: 12 // starting zoom
});


// Error message
function showAlertError(message) {
    $("#alertMsg").addClass("alert-danger");
    $('#alertMsg').html(message);
    $('#alertMsg').removeClass("hide");
    setTimeout(hideAlertError, 5000);
}

// Closing error message
function hideAlertError() {
    $("#alertMsg").addClass("hide");
    $('#alertMsg').removeClass("alert-danger");
}

// Adding new marker (point)
function addPoint() {
    var name = document.getElementById('pointForm').value;
    name = name.trim();

    // If name is empty
    if(!name) {
        showAlertError("Введите название точки!");
        return;
    }
    // If point is in 'pointList'
    if(pointList.indexOf(name) != -1) {
        showAlertError("Точка с таким названием уже существует!");
        // Clear field
        document.getElementById('pointForm').value = '';
        return;
    }
    // Creating popup
    var popup = new mapboxgl.Popup()
        .setHTML('<h3>' + name + '</h3>');

    // Creating marker
    var marker = new mapboxgl.Marker({ draggable: true })
        .setLngLat(map.getCenter())
        .setPopup(popup)
        .addTo(map);

    // Adding marker to 'markerList'
    markerList[name] = marker;

    // Adding new marker to 'pointList' and update
    pointList.push(name);
    updatePointList();

    // Clear field
    document.getElementById('pointForm').value = '';

    // Draw route
    updateDropoffs(dropoffs);
}

// Updating 'pointListElement'
function updatePointList() {
    clearPointListElement();
    for (var i = 0; i < pointList.length; i++) {
        var node = document.createElement("div");
        var textnode = document.createTextNode(pointList[i]);
        node.appendChild(textnode);

        var temp = document.createElement("span");
        var texttemp = document.createTextNode("X");
        temp.appendChild(texttemp);
        temp.classList.add('badge');
        temp.addEventListener('click', deleteItem, false);
        node.appendChild(temp);

        node.classList.add('drag-box');
        node.classList.add('list-group-item');
        pointListElement.appendChild(node);
    }

    dragonfly('.drag-container', function () {
        console.log('This is a callback');
    });
}

// Delete marker
function deleteItem(e) {
    var el = e.target;
    var parent = el.parentElement;
    var child = parent.lastElementChild;
    parent.removeChild(child);

    var name = parent.innerHTML;

    // Remove from 'pointList'
    var index = pointList.indexOf(name); 
    if (index > -1) {
        pointList.splice(index, 1);
    }

    // Remove from 'markerList'
    markerList[name].remove();
    delete markerList[name];

    // Update
    updatePointList();

    // Draw route
    updateDropoffs(dropoffs);  
}

// Clear 'pointListElement'
function clearPointListElement() {
    var child = pointListElement.lastElementChild;
    while (child) {
        pointListElement.removeChild(child);
        child = pointListElement.lastElementChild;
    } 
}

// Getting coordinates of marker
function getCoords(name) {
    var lngLat = markerList[name].getLngLat();
    return [lngLat.lng, lngLat.lat];
}

function changeOrder() {
    var temp = [];

    for (let i = 0; i < pointListElement.children.length; i++) {
        let el = pointListElement.children[i].innerHTML;
        temp[i] = el.match(['[^<]+'])[0];
    }
    pointList = temp;
    updateDropoffs(dropoffs);
}

map.on('load', function() {
    map.addLayer({
        id: 'dropoffs-symbol',
        type: 'symbol',
        source: {
          data: dropoffs,
          type: 'geojson'
        },
        layout: {
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-image': 'marker-15',
        }
    });

    // Listen for a click on the map
    map.on('mouseup', function(e) {
        // When the map is clicked, update the `dropoffs-symbol` layer
        console.log("updateDropoffs")    
        updateDropoffs(dropoffs);
    });

    map.addSource('route', {
        type: 'geojson',
        data: nothing
      });
      
      map.addLayer({
        id: 'routeline-active',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3887be',
          'line-width': [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 3,
            22, 12
          ]
        }
      }, 'waterway-label');

      map.addLayer({
        id: 'routearrows',
        type: 'symbol',
        source: 'route',
        layout: {
          'symbol-placement': 'line',
          'text-field': '▶',
          'text-size': [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 24,
            22, 60
          ],
          'symbol-spacing': [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 30,
            22, 160
          ],
          'text-keep-upright': false
        },
        paint: {
          'text-color': '#3887be',
          'text-halo-color': 'hsl(55, 11%, 96%)',
          'text-halo-width': 3
        }
    }, 'waterway-label');
});

function updateDropoffs(geojson) {

    dropoffs.features = [];
    for(let i = 0; i < pointList.length; i++) {
        var pt = turf.point(
            getCoords(pointList[i]),
            {
                orderTime: Date.now(),
                key: Math.random()
            }
        );
        dropoffs.features.push(pt);

        // Update markers
        
    }

    // Make a request to the Optimization API
    $.ajax({
        method: 'GET',
        url: assembleQueryURL(),
        }).done(function(data) {
        // Create a GeoJSON feature collection
        var routeGeoJSON = turf.featureCollection([turf.feature(data.trips[0].geometry)]);
    
        // If there is no route provided, reset
        if (!data.trips[0]) {
            routeGeoJSON = nothing;
        } else {
            // Update the `route` source by getting the route source
            // and setting the data equal to routeGeoJSON
            map.getSource('route')
            .setData(routeGeoJSON);
        }
    
        // if (data.waypoints.length === 12) {
        //     window.alert('Maximum number of points reached. Read more at mapbox.com/api-documentation/navigation/#optimization.');
        // }
    });    

    map.getSource('dropoffs-symbol')
      .setData(geojson);
}

function assembleQueryURL() {
    var coordinates = [];
    console.log(dropoffs);

    dropoffs.features.forEach(function (d, i) {
        coordinates.push(d.geometry.coordinates);
    });

    if(coordinates.length > 1)
        return 'https://api.mapbox.com/optimized-trips/v1/mapbox/driving/' + coordinates.join(';') + '?roundtrip=false&source=first&destination=last&distributions=0,1&overview=full&steps=true&geometries=geojson&access_token=' + mapboxgl.accessToken;
}
  
function objectToArray(obj) {
    var keys = Object.keys(obj);
    var routeGeoJSON = keys.map(function(key) {
      return obj[key];
    });
    return routeGeoJSON;
}