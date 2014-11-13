require('mapbox.js');
require('angular');
require('angular-leaflet/dist/angular-leaflet-directive');

L.mapbox.accessToken = 'pk.eyJ1IjoiaW5mb2FtYXpvbmlhIiwiYSI6InItajRmMGsifQ.JnRnLDiUXSEpgn7bPDzp7g';

window._ = require('underscore');

var utmToLatLng = require('./utm');

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
			get: $http.get(url),
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
			parse: function(data) {
				var entries = data.feed.entry;
				var parsed = [];
				var gdocsBase = 'gsx$';
				_.each(entries, function(entry) {
					parsed.push({
						casos: entry[gdocsBase + 'casos']['$t'],
						lugar: entry[gdocsBase + 'lugar']['$t'],
						motivo: entry[gdocsBase + 'motivo']['$t'],
						fecha_salida: entry[gdocsBase + 'fechasalida']['$t'],
						meses: entry[gdocsBase + 'meses']['$t'],
						num_alertas: entry[gdocsBase + 'numalertas']['$t'],
						hechos: entry[gdocsBase + 'hechos']['$t'],
						utm_e: entry[gdocsBase + 'utme']['$t'],
						utm_n: entry[gdocsBase + 'utmn']['$t'],
						observaciones: entry[gdocsBase + 'observaciones']['$t'],
						utm: entry[gdocsBase + 'utm']['$t'],
						utm_zone: parseInt(entry[gdocsBase + 'utmzone']['$t']),
						utm_south: parseInt(entry[gdocsBase + 'utmsouth']['$t'])
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
			get: $http.get(url),
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
	function(Alerts, $scope) {

		$scope.filtered = [];

		Alerts.get.success(function(data) {
			$scope.data = Alerts.parse(data);
			$scope.lugares = Alerts.getUniqueVals($scope.data, 'lugar');
			$scope.motivos = Alerts.getUniqueVals($scope.data, 'motivo');
		});

	}
])

.controller('MapController', [
	'leafletData',
	'CartoDBService',
	'$scope',
	function(leafletData, CartoDB, $scope) {

		CartoDB.get.success(function(data) {
			$scope.layers = CartoDB.parse(data);
			$scope.setLayer($scope.layers[0]);
		});

		$scope.setLayer = function(layer) {
			$scope.layer = layer;
		};

		$scope.layerUrl = function(layer) {
			return CartoDB.getUrl(layer);
		}

		$scope.mapDefaults = {
			tileLayer: 'https://4.maps.nlp.nokia.com/maptile/2.1/maptile/newest/satellite.day/{z}/{x}/{y}/256/png8?lg=eng&token=A7tBPacePg9Mj_zghvKt9Q&app_id=KuYppsdXZznpffJsKT24',
			scrollWheelZoom: true,
			maxZoom: 13
		};

		$scope.$on('leafletDirectiveMarker.mouseover', function(event, args) {
			args.leafletEvent.target.openPopup();
			args.leafletEvent.target.setZIndexOffset(1000);
		});

		$scope.$on('leafletDirectiveMarker.mouseout', function(event, args) {
			args.leafletEvent.target.closePopup();
			args.leafletEvent.target.setZIndexOffset(0);
		});

		leafletData.getMap().then(function(map) {

			//map.addLayer(L.tileLayer(mapquest));

			var id = 'infoamazonia.gxbw53jj,infoamazonia.terra,infoamazonia.deforest7-12,infoamazonia.roads-raisg,infoamazonia.osm-brasil';

			var gridLayer = L.mapbox.gridLayer(id);

			map.addLayer(L.mapbox.tileLayer(id));
			map.addLayer(gridLayer);
			map.addControl(L.mapbox.gridControl(gridLayer));

			map.addControl(L.control.scale());

			var legendControl = L.mapbox.legendControl();

			legendControl.addLegend('<div class="legend"><div class="lang-es"><p class="l3-deforestation key"> <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAiSURBVDiNY/yvw/CfgYqAiZqGjRo4auCogaMGjho4lAwEADIrAlIVkvZBAAAAAElFTkSuQmCC"> <span class="label">Área deforestada Agosto 2013 - Julio 2014 </span></p><p class="r-deforestation key"> <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAiSURBVDiNY/x/leE/AxUBEzUNGzVw1MBRA0cNHDVwKBkIAF6JAvvVtl19AAAAAElFTkSuQmCC"><span class="label">Área deforestada 2005 - 2013</span></p></div></div>');

			map.addControl(legendControl);

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

								tileLayer = L.mapbox.tileLayer(tilejson);
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
							message: '<h2>' + item.fecha_salida + ' ' + item.motivo + '</h2>' + '<p>' + item.observaciones + '</p>'
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