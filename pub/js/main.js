$(function () {
	// Pass the auth token with any request
	$.ajaxSetup({
		headers: {'Authorization': loginToken}
	});

	// Setup a global AJAX error handler
	$(document).ajaxError(
			function (event, xhr, options, thrownError) {
				$('#error').text('Server error '
						+ xhr.status
						+ ': '
						+ xhr.statusText
						+ "\n"
						+ 'Message: '
						+ thrownError
						+ 'See your webserver logs for details.'

						).show();
			}
	);

	var accordion = {
		setCurrent: function (stepId) {
			$('#progress .step').removeClass('current-step');
			if (typeof stepId !== 'undefined') {
				$(stepId).addClass('current-step');
			}
		},
		setDone: function (stepId) {
			$(stepId).removeClass('current-step, failed-step');
			$(stepId).addClass('passed-step');
		},
		setFailed: function (stepId) {
			$(stepId).removeClass('current-step,passed-step');
			$(stepId).addClass('failed-step');
		},
		setContent: function (stepId, content, append) {
			var oldContent;
			if (typeof append !== 'undefined' && append) {
				oldContent = $(stepId).find('.output').html();
			} else {
				oldContent = '';
			}
			$(stepId).find('.output').html(oldContent + content);
		},
		showContent: function (stepId) {
			$(stepId).find('.output').show();
		},
		hideContent: function (stepId) {
			$(stepId).find('.output').hide();
		},
		toggleContent: function (stepId) {
			$(stepId).find('.output').toggle();
		}
	},
	handleResponse = function (response, callback, node) {
		if (typeof node === 'undefined') {
			if (response.error_code !== 0) {
				node.text('Error ' + response.error_code).show();
			} else {
				$('#error').hide();
			}
			$('#output').html($('#output').html() + response.output).show();
		} else {
			accordion.setContent(node, response.output);
			accordion.showContent(node);
			if (response.error_code !== 0) {
				accordion.setFailed(node);
			} else {
				accordion.setDone(node);
			}
		}
		if (typeof callback === 'function') {
			callback();
		}
	},
			init = function () {
				accordion.setCurrent('#step-init');
				$.post($('#meta-information').data('endpoint'), {command: 'upgrade:detect --only-check --exit-if-none'})
						.then(function (response) {
							handleResponse(response, function () {}, '#step-init');
							accordion.setDone('#step-init');
							accordion.setCurrent();
							if (!response.error_code) {
								accordion.setContent('#step-init', '<button id="start-upgrade" class="side-button">Start</button>', true);
							} else {
								accordion.setContent('#step-init', '<button id="recheck" class="side-button">Recheck</button>', true);
							}
						});
			};

	//setup handlers
	$(document).on('click', '#create-checkpoint', function () {
		$(this).attr('disabled', true);
		$.post(
				$('#meta-information').data('endpoint'),
				{
					command: 'upgrade:checkpoint --create'
				},
				function (response) {
					$('#create-checkpoint').attr('disabled', false);
					handleResponse(response);
				}
		);
	});

	$(document).on('click', '#progress h3', function () {
		if ($(this).parent('li').hasClass('passed-step')) {
			accordion.toggleContent('#' + $(this).parent('li').attr('id'));
		}
	});

	$(document).on('click', '#start-upgrade', function () {
		$('#output').html('');
		$(this).attr('disabled', true);
		$.post($('#meta-information').data('endpoint'), {command: 'upgrade:checkSystem'})
				.then(function (response) {
					if (response.error_code === 0){
						accordion.setCurrent('#step-checkpoint');
					}
					handleResponse(response, function () {}, '#step-check');
					return response.error_code === 0
							? $.post($('#meta-information').data('endpoint'), {command: 'upgrade:checkpoint --create'})
							: $.Deferred()
							;
				})
				.then(function (response) {
					if (response.error_code === 0){
						accordion.setCurrent('#step-download');
					}
					handleResponse(response, function () {}, '#step-checkpoint');
					return response.error_code === 0
							? $.post($('#meta-information').data('endpoint'), {command: 'upgrade:detect'})
							: $.Deferred()
							;
				})
				.then(function (response) {
					if (response.error_code === 0){
						accordion.setCurrent('#step-coreupgrade');
					}
					handleResponse(response, function () {}, '#step-download');
					return response.error_code === 0
							? $.post($('#meta-information').data('endpoint'), {command: 'upgrade:disableNotShippedApps'})
							: $.Deferred()
							;
				})
				.then(function (response) {
					handleResponse(response, function () {}, '#step-coreupgrade');
					return response.error_code === 0
							? $.post($('#meta-information').data('endpoint'), {command: 'upgrade:executeCoreUpgradeScripts'})
							: $.Deferred()
							;
				})
				.then(function (response) {
					handleResponse(response, function () {}, '#step-coreupgrade');
					return response.error_code === 0
							? $.post($('#meta-information').data('endpoint'), {command: 'upgrade:upgradeShippedApps'})
							: $.Deferred()
							;
				})
				.then(function (response) {
					if (response.error_code === 0){
						accordion.setCurrent('#step-appupgrade');
					}
					handleResponse(response, function () {}, '#step-appupgrade');
					return response.error_code === 0
							? $.post($('#meta-information').data('endpoint'), {command: 'upgrade:enableNotShippedApps'})
							: $.Deferred()
							;
				})
				.then(function (response) {
					if (response.error_code === 0){
						accordion.setCurrent('#step-finalize');
					}
					handleResponse(response, function () {}, '#step-finalize');
					return response.error_code === 0
							? $.post($('#meta-information').data('endpoint'), {command: 'upgrade:restartWebServer'})
							: $.Deferred()
							;
				})
				.then(function (response) {
					handleResponse(response, function () {}, '#step-finalize');
					return response.error_code === 0
							? $.post($('#meta-information').data('endpoint'), {command: 'upgrade:postUpgradeCleanup'})
							: $.Deferred()
							;
				})
				.then(function (response) {
					handleResponse(response, function () {}, '#step-finalize');
					if (response.error_code === 0){
						accordion.setCurrent('#step-done');
						accordion.setContent('#step-done', 'All done!');
					}
				});
	});

	$(document).on('click', '#recheck', init);
	init();
});
