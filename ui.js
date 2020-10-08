$(async function() {
	// cache some selectors we'll be using quite a bit
	const $body = $('body');
	const $allStoriesList = $('#all-articles-list'); //OL containing all the articles
	const $submitForm = $('#submit-form'); //form to submit a new article; starts with hidden class and display-none
	const $filteredArticles = $('#filtered-articles'); //list of filtered articles
	const $favoritedStories = $('#favorited-articles');
	const $loginForm = $('#login-form'); // form to login
	const $createAccountForm = $('#create-account-form'); //form to sign up
	const $ownStories = $('#my-articles'); //list of my stories in my-stories page
	const $navLogin = $('#nav-login'); //link to go to login/signup forms
	const $navSubmit = $('#nav-submit'); //link to click to launch story form
	const $navFavs = $('#nav-fav'); //link to show favorited stories
	const $navHome = $('#nav-all');
	const $navStories = $('#nav-my-stories'); // link to show $ownStories
	const $navLogOut = $('#nav-logout'); //link to log out of account and change nav bar
	const $navWelcome = $('#nav-welcome');
	const $navUserProfile = $('#nav-user-profile');
	const $userProfile = $('#user-profile'); //user-profile info section

	// ********************************************************************************************** \\

	// global storyList variable
	let storyList = null;

	// global currentUser variable
	let currentUser = null;

	await checkIfLoggedIn();

	// ********************************************************************************************** \\
	// event listeners
	// ********************************************************************************************** \\

	/**
   * Event listener for logging in.
   *  set up global currentUser as userInstance
   */
	$loginForm.on('submit', async function(evt) {
		evt.preventDefault(); // no page-refresh on submit

		// grab the username and password
		const username = $('#login-username').val();
		const password = $('#login-password').val();

		// call the login static method to build a user instance
		const userInstance = await User.login(username, password);
		// set the global user to the user instance
		currentUser = userInstance;
		syncCurrentUserToLocalStorage(); //save token to local storage
		loginAndSubmitForm();
	});

	// same as login, but different endpoint here (different static method)

	$createAccountForm.on('submit', async function(evt) {
		evt.preventDefault(); // no page refresh

		// grab the required fields
		let name = $('#create-account-name').val();
		let username = $('#create-account-username').val();
		let password = $('#create-account-password').val();

		// call the create method, which
		//calls the API and then builds a new user instance
		const newUser = await User.create(username, password, name);
		currentUser = newUser;
		syncCurrentUserToLocalStorage();
		loginAndSubmitForm();
	});

	/**
   * Log Out Functionality
   */

	$navLogOut.on('click', function() {
		// empty out local storage
		localStorage.clear();
		// refresh the page completely to give original navbar
		location.reload();
	});

	// click login button
	$navLogin.on('click', function() {
		// Show the Login and Create Account Forms
		$loginForm.slideToggle();
		$createAccountForm.slideToggle();
		$allStoriesList.toggle();
	});

	// click favorites button
	$navFavs.on('click', function() {
		// hide everything under navbar
		hideElements();

		// if logged in, populate the favorites tab and then show it
		if (currentUser) {
			generateFaves();
			$favoritedStories.show();
		}
	});

	// click on username in navbar
	$navUserProfile.on('click', function() {
		hideElements();

		// show just the profile details
		$userProfile.show();
	});

	// click on submit button for new story
	$navSubmit.on('click', function() {
		if (currentUser) {
			hideElements(); //clear everything from the page
			$allStoriesList.show(); //re-show the stories list (wouldn't choose this myself but if it's to work the way the example does, i need to)
			$submitForm.slideToggle();
		}
	});

	// click on the "favorite star"
	$('.articles-container').on('click', '.star', async function(evt) {
		// only works if logged in
		if (currentUser) {
			const $tgt = $(evt.target);
			const $closestLi = $tgt.closest('li'); //find article belonging to that start
			const storyId = $closestLi.attr('id'); //find story id

			// if the item is already favorited
			if ($tgt.hasClass('fas')) {
				// remove the favorite from the user's list
				await currentUser.removeFavorite(storyId);
				// then change the class to be an empty star
				$tgt.closest('i').toggleClass('fas far');
			} else {
				// the item is un-favorited
				await currentUser.addFavorite(storyId); //add favorite to users list
				$tgt.closest('i').toggleClass('fas far'); //toggle star color
			}
		}
	});

	// click on 'my stories" link
	$navStories.on('click', function() {
		hideElements();
		if (currentUser) {
			generateOwn(); //generate list of users stories
			$ownStories.show(); //show the stories element
		}
	});

	//submit a new story
	$submitForm.on('submit', async function(e) {
		e.preventDefault(); //no page change

		//grab values from inputs
		const title = $('#title').val();
		const author = $('#author').val();
		const url = $('#url').val();
		let host = getHostName(url);

		const storyObj = await storyList.addStory(currentUser, { author, title, url });

		// create li story markup to be added to list
		const $li = $(`
		<li id="${storyObj.storyId}" class="id-${storyObj.storyId}">
			<span class="star">
			<i class="far fa-star"></i>
			</span>
			<a class="article-link" href="${url}" target="a_blank">
			<strong>${title}</strong>
			</a>
			<small class="article-author">by ${author}</small>
			<small class="article-hostname ${host}">(${host})</small>
			<small class="article-username">posted by ${storyObj.username}</small>
		</li>
	`);

		// add li to top of page
		$allStoriesList.prepend($li); //prepend story to the dom
		//reset form and hide
		$submitForm.trigger('reset');
		$submitForm.slideToggle();
	});

	/**
   * Event handler for Navigation to Homepage
   */

	$navHome.on('click', async function() {
		hideElements();
		await generateStories();
		$allStoriesList.show();
	});

	// click on delete button in own stories
	$ownStories.on('click', '.trash-can', async function(evt) {
		const $closestLI = $(evt.target).closest('li'); //find story belonging to trashcan
		const Id = $closestLI.attr('id'); //get that story's storyId

		await storyList.removeStory(currentUser, Id); //call removeStory from storyList class instance
		await generateStories(); //regenerate the stories from the api

		hideElements(); //hide all stories
		$allStoriesList.show(); //show the main stories list
	});

	// ********************************************************************************************** \\

	// helper functions

	// ********************************************************************************************** \\
	//generate the favorites page
	function generateFaves() {
		// empty out the list by default
		$favoritedStories.empty();

		// if the user has no favorites
		if (currentUser.favorites.length === 0) {
			$favoritedStories.append('<h5>No favorites added!</h5>');
		} else {
			// for all of the user's favorites
			for (let story of currentUser.favorites) {
				// render each story in the list
				let favoriteHTML = generateStoryHTML(story, false);
				$favoritedStories.append(favoriteHTML);
			}
		}
	}

	// generate the my stories page with users stories
	function generateOwn() {
		// empty out the list by default
		$ownStories.empty();

		// if the user has no stories
		if (currentUser.ownStories.length === 0) {
			$ownStories.append('<h5>No stories added!</h5>');
		} else {
			// for all of the user's stories
			for (let story of currentUser.ownStories) {
				// render each story in the list
				let ownHTML = generateStoryHTML(story, true);
				$ownStories.append(ownHTML);
			}
		}
	}

	// add the profile details for when the username is clicked when logged in
	function generateProfile() {
		$('#profile-name').text(`Name: ${currentUser.name}`);
		// show your username
		$('#profile-username').text(`Username: ${currentUser.username}`);
		// format and display the account creation date
		$('#profile-account-date').text(`Account Created: ${currentUser.createdAt.slice(0, 10)}`);

		$navUserProfile.text(`${currentUser.username}`); //show the username in topright corner to show these details
	}

	/**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */
	async function checkIfLoggedIn() {
		// let's see if we're logged in
		const token = localStorage.getItem('token');
		const username = localStorage.getItem('username');

		// if there is a token in localStorage, call User.getLoggedInUser
		//  to get an instance of User with the right details
		//  this is designed to run once, on page load
		currentUser = await User.getLoggedInUser(token, username);
		await generateStories();

		// if all went well, show the nav bar for someone logged In and generate the profile details
		if (currentUser) {
			showNavForLoggedInUser();
			generateProfile();
		}
	}

	/**
   * A rendering function to run to reset the forms and hide the login info
   */

	function loginAndSubmitForm() {
		// hide the forms for logging in and signing up
		$loginForm.hide();
		$createAccountForm.hide();

		// reset those forms
		$loginForm.trigger('reset');
		$createAccountForm.trigger('reset');

		// show the stories
		$allStoriesList.show();

		// update the navigation bar
		showNavForLoggedInUser();
		generateProfile();
	}

	/**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

	async function generateStories() {
		// get an instance of StoryList
		const storyListInstance = await StoryList.getStories();
		// update our global variable
		storyList = storyListInstance;
		// empty out that part of the page
		$allStoriesList.empty();

		// loop through all of our stories and generate HTML for them
		for (let story of storyList.stories) {
			const result = generateStoryHTML(story);
			$allStoriesList.append(result);
		}
	}

	/**
   * A function to render HTML for an individual Story instance
   */

	function generateStoryHTML(story, isOwnStory) {
		let hostName = getHostName(story.url);
		let starType = isFavorite(story) ? 'fas' : 'far';

		const trash = isOwnStory
			? `<span class="trash-can">
			<i class="fas fa-trash-alt"></i>
		  </span>`
			: '';

		// render story markup
		const storyMarkup = $(`
		<li id="${story.storyId}">
        ${trash}
        <span class="star">
          <i class="${starType} fa-star"></i>
        </span>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
          </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

		return storyMarkup;
	}

	// function to determine if a given story is in a user's favorites
	function isFavorite(story) {
		let favStoryIds = new Set();
		if (currentUser) {
			favStoryIds = new Set(currentUser.favorites.map((obj) => obj.storyId));
		}
		return favStoryIds.has(story.storyId);
	}

	/* hide all elements in elementsArr */

	function hideElements() {
		const elementsArr = [
			$submitForm,
			$allStoriesList,
			$filteredArticles,
			$ownStories,
			$loginForm,
			$createAccountForm,
			$userProfile,
			$favoritedStories
		];
		elementsArr.forEach(($elem) => $elem.hide());
	}

	// show the new navbar for when someone logs in
	function showNavForLoggedInUser() {
		$navLogin.hide();
		$userProfile.hide();

		// show main nav bar
		$('.main-nav-links, #user-profile').toggleClass('hidden');
		$navLogOut.show(); //show logout key
		$navWelcome.show(); // show the area that holds the user-profile anchor
	}

	/* simple function to pull the hostname from a URL */

	function getHostName(url) {
		let hostName; //instantiate hostname variable
		// if the http:// doesn't exist:
		if (url.indexOf('://') > -1) {
			hostName = url.split('/')[2];
		} else {
			hostName = url.split('/')[0];
		}
		// if firt four of hostname are www., take everything after
		if (hostName.slice(0, 4) === 'www.') {
			hostName = hostName.slice(4);
		}
		return hostName;
	}

	/* sync current user information to localStorage */

	function syncCurrentUserToLocalStorage() {
		if (currentUser) {
			localStorage.setItem('token', currentUser.loginToken);
			localStorage.setItem('username', currentUser.username);
		}
	}
});
