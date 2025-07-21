import autoprefixer from 'autoprefixer'
import postcss from 'postcss'
import webpack from 'webpack'
import path from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import classPrefix from 'postcss-class-prefix'
import TerserPlugin from 'terser-webpack-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

const banner = pkg.name + ' v' + pkg.version + ' ' + (pkg.homepage || '')

export default (env, argv) => {
  const config = {
    devtool: 'source-map',
    entry: './src/index.js',
    devServer: {
      static: {
        directory: path.join(__dirname, './'),
      },
      port: 8080,
    },
    output: {
      path: __dirname,
      filename: 'eruda-miniapp-plugin.js',
      publicPath: '/assets/',
      library: ['erudaFarcasterMiniappPlugin'],
      libraryTarget: 'umd',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              sourceType: 'unambiguous',
              presets: ['@babel/preset-env'],
              plugins: ['@babel/plugin-transform-runtime'],
            },
          },
        },
        {
          test: /\.scss$/,
          use: [
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    postcss.plugin('postcss-namespace', function () {
                      // Add '.dev-tools .tools ' to every selector.
                      return function (root) {
                        root.walkRules(function (rule) {
                          if (!rule.selectors) return rule

                          rule.selectors = rule.selectors.map(function (
                            selector
                          ) {
                            return '.dev-tools .tools ' + selector
                          })
                        })
                      }
                    }),
                    classPrefix('eruda-'),
                    autoprefixer,
                  ],
                },
              },
            },
            {
              loader: 'sass-loader',
              options: {
                api: 'modern'
              }
            },
          ],
        },
      ],
    },
    plugins: [new webpack.BannerPlugin(banner)],
  }

  if (argv.mode === 'production') {
    config.optimization = {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
      ],
    }
  }

  return config
}
