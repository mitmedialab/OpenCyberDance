module.exports = {
	globDirectory: '.',
	globPatterns: [
		'**/*.{css,js,ttf,html,glb,wav,m4a,svg,toml,json,yaml,png,md,ts,vue}'
	],
	swDest: 'public',
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	]
};