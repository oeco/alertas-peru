window.L = require('leaflet');

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
	'$scope',
	function(leafletData, $scope) {

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