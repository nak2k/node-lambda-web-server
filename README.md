# lambda-web-server

Local development tool for AWS Lambda.

## Usage

```
npx lambda-web-server --code path/to/lambda --open
```

The `index.js` file in the `path/to/lambda` directory is invoked as the lambda function.

If the `index.ts` file exists, use it prefer of the `index.js`.
In this case, `ts-node` and `typescript` are required.

## Options

```
Options:
  --code          A path of a Lambda function             [string] [default: "."]
  --handler       Names of a module and a function
                                              [string] [default: "index.handler"]
  --open          Open automatically                                    [boolean]
  --port, -p      Listen port                                            [number]
  --project, -P   A path of tsconfig.json                                [string]
  --preprocessor  A path of a preprocessor module                        [string]
  --verbose, -v   Verbose mode                         [boolean] [default: false]
  --version       Show version number                                   [boolean]
  --help          Show help                                             [boolean]
```

## License

MIT
