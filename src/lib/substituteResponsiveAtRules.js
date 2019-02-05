import _ from 'lodash'
import postcss from 'postcss'
import cloneNodes from '../util/cloneNodes'
import buildMediaQuery from '../util/buildMediaQuery'
import buildSelectorVariant from '../util/buildSelectorVariant'

export default function(config) {
  return function(css) {
    const screens = config.screens
    const separator = config.options.separator
    const responsiveRules = []
    let finalRules = []

    css.walkAtRules('responsive', atRule => {
      const nodes = atRule.nodes
      responsiveRules.push(...cloneNodes(nodes))
      atRule.before(nodes)
      atRule.remove()
    })

    _.keys(screens).forEach(screen => {
      const mediaQuery = postcss.atRule({
        name: 'media',
        params: buildMediaQuery(screens[screen]),
      })

      mediaQuery.append(
        // Filter out nested `atRules`; we'll process those separately
        responsiveRules.filter(rule => rule.type !== 'atrule').map(rule => {
          const cloned = rule.clone()
          cloned.selectors = _.map(rule.selectors, selector =>
            buildSelectorVariant(selector, screen, separator, message => {
              throw rule.error(message)
            })
          )
          return cloned
        })
      )

      mediaQuery.append(
        // Process nested `atRules`.
        responsiveRules.filter(rule => rule.type === 'atrule').map(atRule => {
          const clonedAtRule = atRule.clone()
          clonedAtRule.nodes.forEach(rule => {
            rule.selectors = _.map(rule.selectors, selector => {
              const selectorVariant = buildSelectorVariant(selector, screen, separator, message => {
                throw rule.error(message)
              })
              return selectorVariant
            })
          })
          return clonedAtRule
        })
      )

      finalRules.push(mediaQuery)
    })

    const hasScreenRules = finalRules.some(i => i.nodes.length !== 0)

    if (!hasScreenRules) {
      return
    }

    let includesScreensExplicitly = false

    css.walkAtRules('tailwind', atRule => {
      if (atRule.params === 'screens') {
        atRule.replaceWith(finalRules)
        includesScreensExplicitly = true
      }
    })

    if (!includesScreensExplicitly) {
      css.append(finalRules)
      return
    }
  }
}
