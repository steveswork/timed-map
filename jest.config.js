module.exports = {
	collectCoverageFrom: [ 'src/**/*.ts' ],
	detectOpenHandles: true,
	globals: {},
	preset: 'ts-jest',
	testEnvironment: 'node',
	transform: {
		'\\.tsx?$': [
			'ts-jest', {
				diagnostics: {
					ignoreCodes: [
						2322,
						2353,
						2571,
						2741,
						2769,
						6031,
						18003
					]
				}
			}
		]
	}
};
