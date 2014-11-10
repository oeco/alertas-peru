require('angular');
require('angular-leaflet/dist/angular-leaflet-directive');

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

		return {
			get: $http.get(settings.dataUrl)
		};

	}
])

.controller('AlertsController', [
	'$scope',
	'AlertsService',
	function($scope, Alerts) {

		$scope.filtered = [];

		Alerts.get.success(function(data) {
			$scope.data = data;
		});

	}
])

.controller('MapController', [
	'leafletData',
	'MapInteraction',
	'$scope',
	function(leafletData, Interaction, $scope) {

		$scope.$watch(function() {
			return Interaction.get();
		}, function(data) {
			$scope.hover = data;
		})

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

.directive('alertasMap', [
	'leafletData',
	'MapInteraction',
	'$rootScope',
	function(leafletData, Interaction, $rootScope) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {

				var table = attrs.alertasMap;

				var sql = new cartodb.SQL({user: 'infoamazonia'});

				var select = 'SELECT * FROM ' + table;

				leafletData.getMap(attrs.id).then(function(map) {

					cartodb.createLayer(map, {
						user_name: 'infoamazonia',
						type: 'cartodb',
						sublayers: [{
							sql: select,
							cartocss: '#' + table + ' { polygon-fill: #136400; polygon-opacity: 0.2; line-color: #136400; line-width: 1; line-opacity: 0.6; }',
							interactivity: 'area_sig,titular'
						}],
						options: {
							tooltip: true
						}
					})
					.addTo(map)
					.done(function(layer) {

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