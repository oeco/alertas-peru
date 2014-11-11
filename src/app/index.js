require('mapbox.js/src/mapbox');
require('angular');
require('angular-leaflet/dist/angular-leaflet-directive');

L.mapbox.accessToken = 'pk.eyJ1IjoiaW5mb2FtYXpvbmlhIiwiYSI6InItajRmMGsifQ.JnRnLDiUXSEpgn7bPDzp7g';

var $ = require('jquery'),
	_ = require('underscore');

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
			parse: function(data) {
				var entries = data.feed.entry;
				var parsed = [];
				var gdocsBase = 'gsx$';
				_.each(entries, function(entry) {
					parsed.push({
						id: entry[gdocsBase + 'id']['$t'],
						title: entry[gdocsBase + 'title']['$t'],
						content: entry[gdocsBase + 'content']['$t'],
						latitude: parseFloat(entry[gdocsBase + 'latitude']['$t']),
						longitude: parseFloat(entry[gdocsBase + 'longitude']['$t'])
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
			parse: function(data) {
				var parsed = [];
				var entries = data.feed.entry;
				var gdocsBase = 'gsx$';
				_.each(entries, function(entry) {
					parsed.push({
						title: entry[gdocsBase + 'title']['$t'],
						description: entry[gdocsBase + 'description']['$t'],
						user: entry[gdocsBase + 'user']['$t'],
						table: entry[gdocsBase + 'table']['$t'],
						interactivity: entry[gdocsBase + 'interactivity']['$t'],
						cartocss: entry[gdocsBase + 'cartocss']['$t'],
						category: entry[gdocsBase + 'category']['$t']
					});
				});
				return parsed;
			}
		};

	}
])

.factory('MapInteraction', [
	function() {

		var data = false;

		return {
			get: function() {
				return data;
			},
			set: function(d) {
				data = d;
			},
			clear: function() {
				data = false;
			}
		}

	}
])

.controller('AlertsController', [
	'AlertsService',
	'$scope',
	function(Alerts, $scope) {

		$scope.filtered = [];

		Alerts.get.success(function(data) {
			$scope.data = Alerts.parse(data);
		});

	}
])

.controller('MapController', [
	'leafletData',
	'CartoDBService',
	'MapInteraction',
	'$scope',
	function(leafletData, CartoDB, Interaction, $scope) {

		$scope.$watch(function() {
			return Interaction.get();
		}, function(data) {
			$scope.hover = data;
		});

		CartoDB.get.success(function(data) {
			$scope.layers = CartoDB.parse(data);
			$scope.setLayer($scope.layers[0]);
		});

		$scope.setLayer = function(layer) {
			$scope.layer = layer;
		}

		$scope.mapDefaults = {
			scrollWheelZoom: true
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

			var id = 'infoamazonia.forest-amazonia,infoamazonia.forest_height_11,infoamazonia.deforestation-0-6,infoamazonia.gxbw53jj,infoamazonia.r0wqxgvi,infoamazonia.terra,infoamazonia.deforest7-12,infoamazonia.roads-raisg,infoamazonia.amazonia-trees,infoamazonia.osm-brasil';

			var gridLayer = L.mapbox.gridLayer(id);

			map.addLayer(L.mapbox.tileLayer(id));
			map.addLayer(gridLayer);
			map.addControl(L.mapbox.gridControl(gridLayer));

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
	'MapInteraction',
	'$rootScope',
	function(leafletData, Interaction, $rootScope) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {

				var layerData = scope.cartodb;

				var curLayer;

				leafletData.getMap(attrs.id).then(function(map) {

					scope.$watch('layer', function(layer) {

						if(layer && typeof layer !== 'undefined') {

							if(curLayer && typeof curLayer !== 'undefined') {
								map.removeLayer(curLayer);
							}

							cartodb.createLayer(map, {
								user_name: layer.user,
								type: 'cartodb',
								sublayers: [{
									sql: 'SELECT * FROM ' + layer.table,
									cartocss: layer.cartocss,
									interactivity: layer.interactivity
								}],
								options: {
									tooltip: true
								}
							}).addTo(map).done(function(layer) {

								curLayer = layer;

								var sublayer = layer.getSubLayer(0);

								sublayer.setInteraction(true);

								layer.on('featureOver', function(event, latlng, pos, data, layerIndex) {
									Interaction.set(data);
									$rootScope.$broadcast('cartodbFeatureOver', _.extend({id: attrs.group}, data));
								});

								layer.on('featureOut', function(event) {
									Interaction.clear();
									$rootScope.$broadcast('cartodbFeatureOver', {id: attrs.group});
								});

							});

						}

					});

				});

			}
		}
	}
])

.filter('toMarker', [
	function() {
		return _.memoize(function(input) {

			if(input && input.length) {

				var markers = {};
				_.each(input, function(item) {
					var icon = {};
					markers[item.id] = {
						lat: item.latitude,
						lng: item.longitude,
						message: '<h2>' + item.title + '</h2>' + '<p>' + item.content + '</p>'
					};
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