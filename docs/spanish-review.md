# Spanish review (Adrian and Alondra)

Spanish copy shipped as a draft for a native speaker to check (AGENTS rule 7). Reply with changes per key; a session
updates messages/es.json and takes the key off this list. Sessions don't load this file; STATE.md points here.

## Brief 05b, session 2 (Nov 22, 2026)

The pay link now takes the $50 first; the home, ages and backdrops come right after, on the same page. In
`holdText`, "hasta el {until}" keeps the "el" because {until} starts with the weekday ("lunes, 24 de noviembre…").

| Key | English | Spanish |
|---|---|---|
| `bookingRequest.when.hereHelp` | Pick a day and a start time. Best at days 5–14, up to 4 weeks. | Elige un día y una hora. Lo ideal: del día 5 al 14, hasta 4 semanas. |
| `bookingFlow.depositReturn.holdTitle` | Your time is saved, {name}. | Guardamos tu horario, {name}. |
| `bookingFlow.depositReturn.holdText` | {bundle} · {date} at {time} · at your home. Total {total} (travel included). Pay the {deposit} deposit to book it. The rest is paid after your session. We're holding this time until {until} (Miami time). | {bundle} · {date} a las {time} · en tu casa. Total {total} (traslado incluido). Paga el depósito de {deposit} para reservar. El resto se paga después de tu sesión. Te guardamos este horario hasta el {until} (hora de Miami). |
| `bookingFlow.depositReturn.refund` | Refundable up to {hours} h before your session. Card payment on Stripe. | Te devolvemos el depósito si cancelas hasta {hours} h antes. Pago con tarjeta en Stripe. |
| `bookingFlow.depositReturn.payNow` | Pay {deposit} and book my session | Pagar {deposit} y reservar mi sesión |
| `bookingFlow.depositReturn.paidTitle` | You're booked! | ¡Tu sesión está reservada! |
| `bookingFlow.depositReturn.paidText` | Two quick things so we come ready: your home address and your baby's age (it tells us which outfits to bring). Backdrops can wait. | Dos cosas rápidas para llegar listos: tu dirección y la edad de tu bebé (así sabemos qué ropita llevar). Los fondos pueden esperar. |
| `bookingFlow.depositReturn.expiredText` | The deposit for {date} at {time} wasn't paid, so we released the time. You're welcome to pick a time again. | El depósito para el {date} a las {time} no fue pagado, así que liberamos el horario. Puedes elegir otra hora cuando quieras. |
| `emails.deposit.booked.preheader` | Pay the {deposit} deposit to book {date} at {time}. Then add your address, your baby's age and your backdrop. | Paga el depósito de {deposit} para reservar el {date} a las {time}. Luego agrega tu dirección, la edad de tu bebé y tu fondo. |
| `emails.deposit.booked.intro` | {bundle} on {date} at {time}, at your home. To book it, pay the {deposit} deposit. Then add your home address and your baby's age, and pick your backdrop. The rest is paid after your session. | {bundle} el {date} a las {time}, en tu casa. Para reservarla, paga el depósito de {deposit}. Luego agrega la dirección de tu casa y la edad de tu bebé, y elige tu fondo. El resto se paga después de tu sesión. |
| `emails.deposit.booked.smsBody` | Hi {name}! We saved {date} at {time} for your Tiny Humans session. Pay the {deposit} deposit to book it, then add your address, your baby's age and your backdrop here: {url} | ¡Hola {name}! Guardamos el {date} a las {time} para tu sesión de Tiny Humans. Paga el depósito de {deposit} para reservarla y luego agrega tu dirección, la edad de tu bebé y tu fondo aquí: {url} |
| `emails.addHome.title` | Two quick things so we come ready | Dos cosas rápidas para llegar listos |
| `emails.addHome.text` | Your home address and your baby's age (it tells us which outfits to bring). | Tu dirección y la edad de tu bebé (así sabemos qué ropita llevar). |
| `emails.addHome.button` | Add them now | Agregarlas ahora |
| `emails.addHome.textLine` | Two quick things so we come ready: your home address and your baby's age. Add them here: {url} | Dos cosas rápidas para llegar listos: tu dirección y la edad de tu bebé. Agrégalas aquí: {url} |

## Brief 05b, session 1 (Nov 21, 2026)

`{name}`, `{deposit}` and similar are filled in by the site. Keep them as they are.

| Key | English | Spanish |
|---|---|---|
| `bookingRequest.when.notBornHelp` | Pick the date closest to your due date. When baby arrives, text us and we'll set a day between days 5 and 14. | Elige la fecha más cercana a tu fecha de parto. Cuando nazca tu bebé, escríbenos y elegimos un día entre el día 5 y el 14. |
| `bookingRequest.when.includes` | {bundle} includes: {features} | {bundle} incluye: {features} |
| `bookingRequest.when.rowPhotos` | {photos} photos | {photos} fotos |
| `bookingRequest.details.mobileHint` | We text you to confirm. Only about your session. | Te escribimos para confirmar. Solo sobre tu sesión. |
| `bookingRequest.details.emailHint` | For your confirmation. | Para tu confirmación. |
| `bookingRequest.details.zipHint` | So we can check travel. Free within {miles} miles of Miami Beach. | Para calcular el traslado. Gratis a menos de {miles} millas de Miami Beach. |
| `bookingRequest.details.zipHintPlain` | So we can check travel. | Para calcular el traslado. |
| `bookingRequest.details.send` | Request this time | Solicitar este horario |
| `bookingRequest.details.sendDue` | Request my spot | Solicitar mi lugar |
| `bookingRequest.details.under` | Nothing to pay now. After we confirm by text, a {deposit} deposit holds your date. Refundable up to {hours} h before. | No pagas nada ahora. Cuando te confirmemos por mensaje, un depósito de {deposit} aparta tu fecha. Te lo devolvemos si cancelas hasta {hours} h antes. |
| `bookingRequest.details.underDue` | Nothing to pay now. After we confirm by text, a {deposit} deposit saves your spot. If your session can't happen, you choose: get your {deposit} back or put it toward a session when baby is older. | No pagas nada ahora. Cuando te confirmemos por mensaje, un depósito de {deposit} guarda tu lugar. Si tu sesión no puede hacerse, tú eliges: te devolvemos los {deposit} o los usas para una sesión cuando tu bebé sea más grande. |
| `bookingRequest.details.errors.mobile` | Enter a 10-digit US mobile number, like 305 555 0100. | Escribe un celular de EE. UU. de 10 dígitos, por ejemplo 305 555 0100. |
| `bookingRequest.details.errors.email` | Check your email. It needs an @ and a dot, like ana@gmail.com. | Revisa tu correo. Necesita una @ y un punto, como ana@gmail.com. |
| `bookingRequest.details.errors.slotTaken` | Someone just booked that time. Pick another one. What you typed is saved. | Alguien acaba de tomar esa hora. Elige otra. Lo que escribiste se guardó. |
| `bookingRequest.details.errors.generic` | We couldn't send your request just now. Please try again, or text us at (786) 222-7194. Your answers are still here. | No pudimos enviar tu solicitud. Inténtalo de nuevo o escríbenos al (786) 222-7194. Tus respuestas siguen aquí. |
| `bookingRequest.sent.textYou` | Adrian or Alondra will text you at {mobile} to confirm {when}. We reply 8 a.m.–8 p.m., usually within minutes. We're holding this time for you for {hours} hours. | Adrian o Alondra te escribirán al {mobile} para confirmar {when}. Respondemos de 8 a. m. a 8 p. m., casi siempre en minutos. Te guardamos este horario por {hours} horas. |
| `bookingRequest.sent.textYouDue` | Adrian or Alondra will text you at {mobile} to save your spot near {date}. When baby arrives, text us and we'll set a day between days 5 and 14. | Adrian o Alondra te escribirán al {mobile} para guardar tu lugar cerca del {date}. Cuando nazca tu bebé, escríbenos y elegimos un día entre el día 5 y el 14. |
| `bookingRequest.sent.next` | What happens next: | Qué sigue: |
| `bookingRequest.sent.steps.0` | We confirm by text (you'll get an email too). | Te confirmamos por mensaje (también te llega un correo). |
| `bookingRequest.sent.steps.1` | Pay the {deposit} deposit from our link to book it. | Pagas el depósito de {deposit} con nuestro enlace para reservar. |
| `bookingRequest.sent.steps.2` | We come to your home with lights, backdrops and wraps. | Llegamos a tu casa con luces, fondos y mantas. |
| `bookingRequest.sent.noText` | No text from us yet? | ¿Aún no te escribimos? |
| `bookingRequest.sent.question` | Text {phone}. | Escríbenos al {phone}. |
| `landing.hero.concepts.a.sub` | We bring the lights, backdrops and wraps to your home in Miami. You skip the car seat and the studio, and your baby sets the pace. You see your photos the next day. Not born yet? You can book with your due date. | Llevamos las luces, los fondos y las mantas a tu casa en Miami. Te ahorras la silla del carro y el estudio, y tu bebé marca el ritmo. Ves tus fotos al día siguiente. ¿Tu bebé aún no nace? También puedes reservar con tu fecha de parto. |
| `landing.hero.concepts.b.sub` | Pick a date near your due date now. When baby arrives, text us and we come to your home between days 5 and 14. | Elige ahora una fecha cerca de tu fecha de parto. Cuando nazca tu bebé, nos escribes y vamos a tu casa entre el día 5 y el 14. |
| `landing.faq.items.1.a` | Best in the first two weeks (days 5–14), and we can still come up to 4 weeks. Many families reserve ahead with a date near their due date, and we move it when baby arrives. | Lo ideal es en las primeras dos semanas (del día 5 al 14), y también podemos ir hasta las 4 semanas. Muchas familias reservan con tiempo una fecha cerca de su fecha de parto, y la movemos cuando nace el bebé. |
| `about.meta.description` | Meet Adrian and Alondra, the parents behind Tiny Humans: newborn photos at home in Miami. | Conoce a Adrian y Alondra, los padres detrás de Tiny Humans: fotos de recién nacidos en casa en Miami. |
| `bookingFlow.confirmation.title` | You're booked, {name}! | ¡Tu sesión está reservada, {name}! |
| `reschedulePage.doneTitle` | Your session is rescheduled | Tu sesión fue reprogramada |
| `extras.title` | {name}, add more photos | {name}, agrega más fotos |
| `review.title` | {name}, how was your session? | {name}, ¿cómo fue tu sesión? |

## Earlier sessions (keys only; the text is in messages/es.json)

es.json `landing`, home.hero, portfolioPage, home.portfolio.photoAlt, header.home, bundlesPage.section.due,
bookingRequest.when (twinsPerks, bundle, change), bookingRequest.link + texts.link, prep gender,
bookingFlow.errors.tripDay, Privacy step-counter sentence, pay.reserved, emails.reminder24.before + prepGuide 2–3,
extras, emails.extrasPaid + afterSession.extras*, Terms photos + Privacy Stripe line, depositReturn age*.
