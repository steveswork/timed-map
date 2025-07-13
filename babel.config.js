module.exports = function ( api ) {
	const config = {
		plugins: [ '@babel/plugin-proposal-nullish-coalescing-operator' ],
		presets: [ '@babel/preset-env' ]
	};
	if( api.env( 'test' ) ) {
		config.plugins.push( '@babel/plugin-transform-runtime' );
	} else {
		config.ignore = [
			'**/test',
			'**/*.test',
			'test-artifacts'
		];
	};
	return config;
}
