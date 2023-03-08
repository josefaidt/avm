import * as readline from 'node:readline'
import { stdin as input, stdout as output } from 'node:process'
import kleur from 'kleur'
import { z } from 'zod'

const options_schema = z.object({
  suffix: z.string().optional(),
})

export function prompt(
  question: string,
  options?: z.infer<typeof options_schema>
): Promise<string> {
  const { suffix } = options_schema.parse(options ?? {})

  const rl = readline.createInterface({
    input,
    output,
  })

  return new Promise((resolve) => {
    rl.question(`${question} ${suffix} `, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

export async function confirm(question: string): Promise<boolean> {
  const validAnswers = ['y', 'n', '']
  const answer = await prompt(question, {
    suffix: kleur.dim('(Y/n)'),
  })
  if (!validAnswers.includes(answer.toLowerCase())) {
    console.error(kleur.red('Invalid answer.'))
    return confirm(question)
  }
  return answer === '' || answer.toLowerCase() === 'y'
}
