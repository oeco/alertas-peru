require('angular');
require('angular-leaflet/dist/angular-leaflet-directive');

L.mapbox.accessToken = 'pk.eyJ1IjoiaW5mb2FtYXpvbmlhIiwiYSI6InItajRmMGsifQ.JnRnLDiUXSEpgn7bPDzp7g';

window.markerIcon = {
	iconUrl: 'img/alert.png',
	shadowUrl: '',
	iconSize:     [20, 24], // size of the icon
	shadowSize:   [0, 0], // size of the shadow
	iconAnchor:   [10, 24], // point of the icon which will correspond to marker's location
	shadowAnchor: [0, 0],  // the same for the shadow
	popupAnchor:  [0, -22] // point from which the popup should open relative to the iconAnchor
}

window._ = require('underscore');

var utmToLatLng = require('./utm');

function removeAccentMark(str) {

	var map = {
		a : /[\xE0-\xE6]/g,
		A : /[\xC0-\xC6]/g,
		e : /[\xE8-\xEB]/g,
		E : /[\xC8-\xCB]/g,
		i : /[\xEC-\xEF]/g,
		I : /[\xCC-\xCF]/g,
		o : /[\xF2-\xF6]/g,
		O : /[\xD2-\xD6]/g,
		u : /[\xF9-\xFC]/g,
		U : /[\xD9-\xDC]/g,
		c : /\xE7/g,
		C : /\xC7/g,
		n : /\xF1/g,
		N : /\xD1/g,
	};

	for(var l in map ) {
		var exp = map[l];
		str = str.replace(exp, l);
	}

	return str;
}

/*
 * Settings
 */

var settings = require('./settings');

angular.module('alertas', ['leaflet-directive'])

.factory('AlertsService', [
	'$http',
	function($http) {

		var url = settings.content;

		return {
			get: function() {
				return $http.get(url);
			},
			getUniqueVals: function(content, key) {
				var vals = [];
				_.each(content, function(item) {
					if(item[key])
						vals.push(item[key]);
				});
				return _.uniq(vals);
			},
			getLatLngs: function(utm, zone) {

				var latlngs = [];
				utm = utm.split(';');

				_.each(utm, function(coord) {
					coord = coord.split(',');
					latlngs.push(utmToLatLng(parseInt(coord[0]), parseInt(coord[1]), zone, true));
				});

				return latlngs;

			},
			getIcon: function(type) {
				var icon = '';
				var base = 'img/tipo/';
				if(type.indexOf('í') !== -1) {
					console.log(type);
				}
				switch(type) {
					case 'Mineria Ilegal':
						icon = base + 'mineria.png';
						break;
					case 'Invasion de presuntos agricultores':
						icon = base + 'invasion.png';
						break;
					case 'Cambio de uso':
						icon = base + 'cambio.png';
						break;
					case 'Verificacion de Grifo':
						icon = base + 'grifo.png';
						break;
				}
				return icon;
			},
			parse: function(data) {
				var entries = data.feed.entry;
				var parsed = [];
				var gdocsBase = 'gsx$';
				_.each(entries, function(entry) {
					parsed.push({
						casos: entry[gdocsBase + 'casos']['$t'],
						lugar: entry[gdocsBase + 'lugar']['$t'],
						motivo: entry[gdocsBase + 'motivo']['$t'],
						_motivo: removeAccentMark(entry[gdocsBase + 'motivo']['$t']),
						fecha_salida: entry[gdocsBase + 'fechasalida']['$t'],
						meses: entry[gdocsBase + 'meses']['$t'],
						num_alertas: entry[gdocsBase + 'numalertas']['$t'],
						hechos: entry[gdocsBase + 'hechos']['$t'],
						utm_e: entry[gdocsBase + 'utme']['$t'],
						utm_n: entry[gdocsBase + 'utmn']['$t'],
						observaciones: entry[gdocsBase + 'observaciones']['$t'],
						utm: entry[gdocsBase + 'utm']['$t'],
						utm_zone: parseInt(entry[gdocsBase + 'utmzone']['$t']),
						utm_south: parseInt(entry[gdocsBase + 'utmsouth']['$t']),
						link: entry[gdocsBase + 'link']['$t']
					});
				});
				return parsed;
			}
		};

	}
])

.factory('CartoDBService', [
	'$http',
	function($http) {

		var url = settings.layers;

		return {
			get: function() {
				return $http.get(url);
			},
			getUrl: function(layer) {
				return 'https://' + layer.user + '.cartodb.com/tables/' + layer.table + '/public/map';
			},
			parse: function(data) {
				var parsed = [];
				var entries = data.feed.entry;
				var gdocsBase = 'gsx$';
				_.each(entries, function(entry) {
					parsed.push({
						title: entry[gdocsBase + 'title']['$t'],
						shortTitle: entry[gdocsBase + 'shorttitle']['$t'],
						user: entry[gdocsBase + 'user']['$t'],
						table: entry[gdocsBase + 'table']['$t'],
						where: entry[gdocsBase + 'where']['$t'],
						interactivity: entry[gdocsBase + 'interactivity']['$t'],
						cartocss: entry[gdocsBase + 'cartocss']['$t'],
						template: entry[gdocsBase + 'template']['$t']
					});
				});
				return parsed;
			}
		};

	}
])

.controller('AlertsController', [
	'AlertsService',
	'$scope',
	'leafletData',
	function(Alerts, $scope, leafletData) {

		$scope.filtered = [];

		Alerts.get().success(function(data) {
			$scope.data = Alerts.parse(data);
			$scope.lugares = Alerts.getUniqueVals($scope.data, 'lugar');
			$scope.motivos = Alerts.getUniqueVals($scope.data, 'motivo');
		});

		$scope.getIcon = Alerts.getIcon;

		var focusLayer = L.featureGroup();
		var focusIcon = L.divIcon({
			className: 'focus-icon',
			iconSize: [80,80]
		});

		leafletData.getMap().then(function(map) {
			focusLayer.addTo(map);
			$scope.focusMap = function(item) {
				$scope.focusedItem = item;
				focusLayer.clearLayers();
				var latLngs = Alerts.getLatLngs(item.utm, item.utm_zone);
				_.each(latLngs, function(latLng, i) {
					var latLng = L.latLng([latLng.latitude, latLng.longitude]);
					L.marker(latLng, {icon: focusIcon}).addTo(focusLayer);
				});
				map.fitBounds(focusLayer.getBounds());
			};
		});

	}
])

.controller('MapController', [
	'leafletData',
	'CartoDBService',
	'$scope',
	'$timeout',
	function(leafletData, CartoDB, $scope, $timeout) {

		CartoDB.get().success(function(data) {
			$scope.layers = CartoDB.parse(data);
			$scope.setLayer($scope.layers[0]);
		});

		$scope.setLayer = function(layer) {
			$scope.layer = layer;
		};

		$scope.layerUrl = function(layer) {
			return CartoDB.getUrl(layer);
		}

		$scope.baseLayers = {
			nokia: {
				name: 'Nokia Satélite',
				type: 'xyz',
				url: 'https://4.maps.nlp.nokia.com/maptile/2.1/maptile/newest/satellite.day/{z}/{x}/{y}/256/png8?lg=eng&token=A7tBPacePg9Mj_zghvKt9Q&app_id=KuYppsdXZznpffJsKT24',
			},
			mapbox: {
				name: 'Ríos y calles',
				type: 'xyz',
				url: 'https://{s}.tiles.mapbox.com/v4/infoamazonia.k8fmob32/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiaW5mb2FtYXpvbmlhIiwiYSI6InItajRmMGsifQ.JnRnLDiUXSEpgn7bPDzp7g',
			},
			mapbox_sat: {
				name: 'MapBox Satélite',
				type: 'xyz',
				url: 'https://{s}.tiles.mapbox.com/v4/infoamazonia.lejpdah7/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiaW5mb2FtYXpvbmlhIiwiYSI6InItajRmMGsifQ.JnRnLDiUXSEpgn7bPDzp7g',
			}
		};

		$scope.mapLayers = {
			baselayers: {
				baselayer: $scope.baseLayers.mapbox
			}
		};

		$scope.setBaseLayer = function(key) {
			$scope.mapLayers.baselayers.baselayer = _.clone($scope.baseLayers[key]);
			$scope.mapLayers.baselayers.baselayer.doRefresh = true;
		};

		$scope.mapDefaults = {
			// tileLayer: $scope.baseLayers.mapbox,
			scrollWheelZoom: true,
			maxZoom: 14,
			controls: {
				layers: {
					visible: false
				}
			}
		};

		$scope.$on('leafletDirectiveMarker.mouseover', function(event, args) {
			args.leafletEvent.target.openPopup();
			args.leafletEvent.target.setZIndexOffset(20);
		});

		$scope.$on('leafletDirectiveMarker.mouseout', function(event, args) {
			args.leafletEvent.target.closePopup();
			args.leafletEvent.target.setZIndexOffset(0);
		});

		var addMapBoxLayer = function(map, id) {

			var gridLayer = L.mapbox.gridLayer(id);

			map.addLayer(L.mapbox.tileLayer(id, {zIndex: 2}));
			map.addLayer(gridLayer);
			map.addControl(L.mapbox.gridControl(gridLayer));

		};

		leafletData.getMap().then(function(map) {

			/*
			 * Mini Map
			 */

			var miniMap = new L.Control.MiniMap(L.tileLayer('https://{s}.tiles.mapbox.com/v4/base.live-satellite+0.00x1.00;0.00x1.00;0.00x1.00;0.00x1.00,base.mapbox-streets+scale-1_water-0.00x1.00;0.00x1.00;0.00x1.00;0.00x0.00_streets-0.00x0.00;0.00x0.00;1.00x0.00;0.00x1.00_landuse-0.00x1.00;0.00x1.00;0.00x1.00;0.00x0.00_buildings-0.00x1.00;0.00x1.00;0.00x1.00;0.00x0.00/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6IlhHVkZmaW8ifQ.hAMX5hSW-QnTeRCMAy9A8Q'), {
				zoomLevelOffset: -5,
				position: 'bottomleft'
			});

			map.addControl(miniMap);

			/*
			 * Scale
			 */

			map.addControl(L.control.scale());

			/*
			 * Base Layer
			 */

			addMapBoxLayer(map, 'infoamazonia.terra,infoamazonia.deforest7-12');

			var legendControl = L.mapbox.legendControl();

			legendControl.addLegend('<div class="legend"><div class="lang-es"><p class="l3-deforestation key"> <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAiSURBVDiNY/yvw/CfgYqAiZqGjRo4auCogaMGjho4lAwEADIrAlIVkvZBAAAAAElFTkSuQmCC"> <span class="label">Área deforestada Agosto 2013 - Julio 2014 </span></p><p class="r-deforestation key"> <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAiSURBVDiNY/x/leE/AxUBEzUNGzVw1MBRA0cNHDVwKBkIAF6JAvvVtl19AAAAAElFTkSuQmCC"><span class="label">Área deforestada 2005 - 2013</span></p></div></div>');

			map.addControl(legendControl);

			/*
			 * Rivers
			 */

			addMapBoxLayer(map, 'infoamazonia.rivers');

		});

		$scope.$watch('markers', function(markers) {

			if(markers && !_.isEmpty(markers)) {

				var latLngs = [];

				_.each(markers, function(marker) {

					latLngs.push([
						marker.lat,
						marker.lng
					]);

				});

				var bounds = L.latLngBounds(latLngs);

				leafletData.getMap().then(function(m) {

					m.fitBounds(bounds, { reset: true });

				});

			}

		});

	}
])

.directive('alertasMap', [
	'leafletData',
	'$rootScope',
	function(leafletData, $rootScope) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {

				var layerData = scope.cartodb;

				var tileLayer = false;
				var gridLayer = false;
				var gridControl = false;

				leafletData.getMap(attrs.id).then(function(map) {

					scope.$watch('layer', function(layer) {

						if(layer && typeof layer !== 'undefined') {

							if(tileLayer) {
								map.removeLayer(tileLayer);
							}

							if(gridLayer) {
								map.removeLayer(gridLayer);
							}

							if(gridControl) {
								map.removeControl(gridControl);
							}

							var where = '';

							if(layer.where) {
								where = ' WHERE ' + layer.where;
							}

							var options = {
								user_name: layer.user,
								type: 'cartodb',
								sublayers: [{
									sql: 'SELECT * FROM ' + layer.table + where,
									cartocss: layer.cartocss,
									interactivity: layer.interactivity
								}]
							};

							cartodb.Tiles.getTiles(options, function(tiles) {

								var tilejson = {
									"scheme": "xyz",
									"tilejson": "2.0.0",
									"grids": [tiles.grids[0][0].replace('{s}', 'a')],
									"tiles": [tiles.tiles[0].replace('{s}', 'a')],
									"template": layer.template
								};

								tileLayer = L.mapbox.tileLayer(tilejson, {zIndex: 5});
								gridLayer = L.mapbox.gridLayer(tilejson);
								gridControl = L.mapbox.gridControl(gridLayer);

								map.addLayer(tileLayer);
								map.addLayer(gridLayer);
								map.addControl(gridControl);

							});

						}

					});

				});

			}
		}
	}
])

.filter('toMarker', [
	'AlertsService',
	function(Alerts) {
		return _.memoize(function(input) {

			if(input && input.length) {

				var markers = {};
				_.each(input, function(item, i) {
					var icon = {};
					var latLngs = Alerts.getLatLngs(item.utm, item.utm_zone);
					_.each(latLngs, function(latLng, c) {
						markers[i + '_' + c] = {
							lat: latLng.latitude,
							lng: latLng.longitude,
							message: '<h2>' + item.fecha_salida + ' ' + item.motivo + '</h2>' + '<p>' + item.hechos + '</p>',
							icon: markerIcon
						};
					});
				});

				return markers;

			}

			return {};

		}, function() {
			return JSON.stringify(arguments);
		});
	}
]);

angular.bootstrap(document, ['alertas']);

/*
 * UI
 */

$(document).ready(function() {
	$('#content')
	.on('mouseover', function() {
		$('body').addClass('hovering-alerts');
	})
	.on('mouseout', function() {
		$('body').removeClass('hovering-alerts');
	});
});
