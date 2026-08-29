// Camada extra de confirmação antes de correr 'prisma migrate reset'.
// O reset APAGA A BASE DE DADOS INTEIRA (todas as equipas, perguntas,
// histórico, e a própria configuração de Admin/password) e recria-a do
// zero a partir das migrações. O próprio Prisma já pede confirmação, mas
// este aviso extra existe para que nunca aconteça "sem querer" só por
// teres corrido o comando errado depressa demais.
//
// O backup já foi feito por "npm run db:backup" ANTES deste script correr
// (ver o script "migrate:reset" no package.json) - por isso o aviso aqui
// menciona onde encontrar essa cópia se precisares de restaurar depois.

const readline = require('readline')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

console.log('')
console.log('==================================================================')
console.log(' ATENÇÃO - vais correr "prisma migrate reset"')
console.log(' Isto APAGA TODA a base de dados atual (equipas, perguntas,')
console.log(' histórico, moderadores, password/2FA do Admin, tudo) e recria-a')
console.log(' do zero a partir das migrações.')
console.log('')
console.log(' Já foi feita uma cópia de segurança em prisma/backups/ antes')
console.log(' deste aviso - mas depois do reset terás de reconfigurar o Admin')
console.log(' (password + QR code do autenticador) e restaurar dados manualmente')
console.log(' se precisares deles.')
console.log('==================================================================')
console.log('')

rl.question('Escreve exatamente RESET para continuar, ou qualquer outra coisa para cancelar: ', (answer) => {
  rl.close()
  if (answer.trim() === 'RESET') {
    console.log('[confirm-reset] Confirmado - a continuar com o reset...')
    process.exit(0)
  } else {
    console.log('[confirm-reset] Cancelado. Nenhuma alteração foi feita.')
    process.exit(1)
  }
})
