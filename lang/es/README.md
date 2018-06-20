![OpenWeatherStation (OWS)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/OpenWeatherStation.png)

**OpenWeatherStation es una estación meteorológica de código abierto (OWS) "hágalo usted mismo" que es asequible, estable, fácil de construir y probada por años. Se desarrolló a partir de varias versiones previas que he estado probando y utilizando en el campo desde finales de 2012 hasta la actualidad.**

___Ing. Francisco Clariá___

![OpenWeatherStation Presentation (OWS)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/openweatherstation_presentation.jpg)
# No te pierdas los tutoriales de YouTube!
Echa un vistazo a los [tutoriales de Youtube](#tutoriales-de-youtube) que te guiarán por todos los pasos para preparar la estación :)

# Tabla de contenidos

* [Métricas de clima](#métricas-de-clima) 
* [Concepto](#concepto) 
  * [Motivación y objetivos](#motivación-y-objetivos) 
    * [Asequible](#asequible) 
    * [Compacto y poco atractivo al robo](#compacto-y-poco-atractivo-al-robo) 
    * [Simple y repetible de construir](#simple-y-repetible-de-construir) 
    * [Wifi y red de telefonía celular](#wifi-y-red-de-telefonía-celular) 
    * [Resistente a cortes de electricidad](#resistente-a-cortes-de-electricidad) 
    * [Estabilidad del software](#estabilidad-del-software) 
    * [Visualización de datos y diagnóstico](#visualización-de-datos-y-diagnóstico) 
    * [Registro de datos y almacenamiento](#registro-de-datos-y-almacenamiento) 
    * [Mantenimiento reducido](#mantenimiento-reducido) 
  * [Por qué Arduino?](#por-qué-arduino) 
* [Aplicación Android](#aplicación-android) 
  * [Conectando a otros dispositivos](#conectando-a-otros-dispositivos) 
* [Armado del módulo Arduino](#armado-del-módulo-arduino) 
  * [Tutoriales de Youtube](#tutoriales-de-youtube) 
  * [Diagrama esquemático](#diagrama-esquemático) 
  * [Lista de materiales](#lista-de-materiales) 
  * [Soldadura y cableado](#soldadura-y-cableado) 
  * [Grabado de PCB](#grabado-de-pcb) 
  * [Perforando el PCB](#perforando-el-pcb) 
  * [Soldando componentes](#soldando-componentes) 
  * [Cableado y conexión de sensores](#cableado-y-conexión-de-sensores) 
  * [Alimentando el módulo arduino](#alimentando-el-módulo-arduino) 
  * [Recomendaciones para exteriores](#recomendaciones-para-exteriores) 
  * [Cargar el código al arduino](#cargar-el-código-al-arduino) 
  * [Conexión bluetooth al módulo OWS](#conexión-bluetooth-al-módulo-ows) 
  * [Envío de comandos al módulo OWS](#envío-de-comandos-al-módulo-ows) 
* [Autor](#autor) 

# Métricas de clima
**La información generada por OWS cada minuto es la siguiente:**
  * velocidad del viento (m / s)
  * dirección del viento (ángulo)
  * ráfaga de viento (m / s)
  * dirección de la ráfaga de viento (ángulo)
  * lluvia (mm)
  * temperatura (Cº)
  * presión atmosférica absoluta (Pascal)
  * humedad relativa (%)
  * luz ambiente (lux)

# Concepto
La implementación actual es mi enfoque personal a los desafíos que he enfrentado durante varios años al tratar con una gran cantidad de escenarios inesperados en ambientes reales. Dicho esto, vamos a entender cómo funciona:

![OWS Concept](https://github.com/panchazo/open-weather-station/raw/master/docs/img/concept.jpg)

Un módulo Arduino Uno lee los datos de los sensores y cada 1 minuto envía datos a través de Bluetooth a un dispositivo conectado. El "dispositivo conectado" es un teléfono inteligente Android que ejecuta una aplicación que recibe esta información, la almacena en la memoria, muestra los datos en la pantalla y, si es necesario, puede enviar las medidas a un servicio externo utilizando los ajustes preestablecidos para Wunderground, Thingspeak, Windguru, OpenWeatherMap u otro servicio personalizable de su preferencia, ya sea a través de wifi y / o red móvil: esta es una de las principales ventajas de usar el teléfono inteligente. También puede escribir un programa Raspberry Pi para conectarse a Arduino a través de bluetooth y recibir los datos si la aplicación de Android no es adecuada para usted (la implementación de Pi no está dentro del alcance del proyecto).

A continuación puede leer más sobre los conceptos detrás de esta implementación. De lo contrario, [haga clic aquí para ir a las instrucciones de ensamblaje](#armado-del-módulo-arduino).

# Motivación y objetivos
Antes del enfoque actual he programado y probado otras alternativas como: raspberry, pic, arduino + wifi shield, arduino + ethernet shield, arduino + GPRs shield, arduino uno + arduino mega, wifi boards, routers, arduino integrado con módulos sd / microsd , etc., etc. y finalmente el enfoque actual resultó ser el más efectivo para mis objetivos por lo siguiente:

### Asequible 
Intenté hacer el precio lo más bajo posible para que no sea una barrera especialmente para aquellos en países donde los productos electrónicos son caros, actualmente el costo total es de entre 300USD a 500USD, incluidos sensores, teléfono, caja para exteriores, etc., dependiendo de su país y principalmente teléfono que use el precio va a variar

### Compacto y poco atractivo al robo
Normalmente la estación se colocará en una azotea, torre, etc. de alguien que permitió instalar el dispositivo, ya que es muy compacto lo hace menos atractivo para los ladrones, más fácil de instalar, se ve mejor y los elementos como el viento, la lluvia, el granizo hará menos daño. Además, como el módulo arduino se conecta a través de bluetooth, el teléfono al que está conectado se puede colocar en un lugar más seguro, como dentro de la vivienda para evitar el robo.

### Simple y repetible de construir
Algunas de las soluciones que evalué antes incluían muchas pruebas, configuración previa o calibración, ensamblaje complejo o incluso dificultad para obtener las piezas de CADA estación que tenía que construir, el enfoque actual de OWS reduce ese problema al mínimo y ésta guía permite armar con exactitud desde 0 a 100% la estación.

### Wifi y red de telefonía celular
Al utilizar un teléfono inteligente Android, existe la posibilidad de conectarme a través de una red wifi y celular, según sea necesario, para seguir actualizando los servicios externos. Y aún más, si se pierde la conexión wifi, se cambiará automáticamente a la red celular sin ningún tipo de molestia, sin comandos AT o complejos handshakes para lograr una conexión HTTP lo que también simplifica  el código del Arduino y su estabilidad...

### Resistente a cortes de electricidad
La electricidad se interrumpe muchas veces, especialmente durante tormentas: el módulo Arduino puede permanecer encendido durante aproximadamente un día con un banco de energía (powerbank) de 5000 mAh y el teléfono celular ya tiene baterías, por lo que, dependiendo del modelo, funcionará probablemente durante un día y además se pueden enviar datos si la red móvil funciona (es probable que wifi falle en este escenario)

### Estabilidad del software
El software del módulo Arduino es realmente robusto, si se reinicia comenzará desde cero sin ningún tipo de problema, incluso agregué un watchdog para que se reinicie si por alguna razón algún proceso lleva más de 4 segundos. En este sentido, he probado antes de la versión actual durante largos períodos de tiempo los shields sd, ethernet, wifi y GPRs y TODOS se cuelgan después de algunas semanas o incluso menos, lo que requiere un reinicio manual y en el caso de la memoria SD incluso necesita extraerse la tarjeta y volver a insertarla, razón por la cual opté por hacer el proyecto este sin esos módulos inestables. Por otro lado, después de largos períodos de pruebas descubrí que Android es sólido y que la resistencia de los teléfonos inteligentes (como una moto E / moto G) es increíble, con temperaturas inferiores a 0 ° C y más de 50 ° C , experimentando incluso cortes de energía repetidamente, así como pérdida de conectividad sin que se cuelgue el software.

### Visualización de datos y diagnóstico
La aplicación permite tanto servir como una pantalla de visualización offline como así también al realizar una nueva instalación o mantenimiento para ver qué está pasando con el módulo. A veces necesito asegurarme de que el OWS esté funcionando correctamente, especialmente durante una nueva instalación o mantenimiento, y la mayor parte del tiempo realizo esta tarea solo, en una torre o en un tejado donde no es apropiado llevar una computadora portátil conmigo, por lo tanto, teniendo el Arduino conectado a través de Bluetooth al smartphone permite un diagnóstico más sencillo. 

### Registro de datos y almacenamiento
Como se mencionó antes, agregar memoria al módulo arduino fue una de las cosas que aumentó en versiones previas la necesidad de mantenimiento, ya que SD se cuelga y la EEPROM se agota, sin mencionar que el almacenamiento y recuperación de grandes cantidades de datos (muchos días de 1 muestra por minuto) es un proceso lento y complejo para que Arduino maneje adecuadamente. Por este motivo, el módulo arduino almacena muestras durante aproximadamente 15 minutos (límite configurable) y luego la aplicación de Android maneja el almacenado permanente de datos, la visualización y la carga de una manera más eficiente y estable. Además permite almacenar períodos de tiempo más largos en la memoria del teléfono.

### Mantenimiento reducido
Todo lo anterior apunta en definitiva a reducir los tiempos de implementación e incidencias en el mantenimiento tanto como se pueda, ya que la mayoría de las estaciones normalmente están ubicadas en lugares remotos, donde debe solicitarse acceso al propietario y todo debe hacerse lo más rápido posible.

## Por qué Arduino?
Las principales razones por las que decidí usar Arduino son:

  * adopción generalizada
  * gran comunidad
  * documentación
  * ejemplos en todas partes
  * bibliotecas disponibles para realizar tareas comunes
  * precio bajo
  * disponible en muchos países
  * alimentar el Arduino es fácil y conveniente (por ejemplo, directamente desde el powerbank USB)
  * para alimentar los sensores también es muy fácil ya que tiene salidas reguladas de 3.3v y 5v que pueden alimentar hasta 150mA (desde 3.3v) o 400mA (desde 5v) cuando están conectados a través de USB
  * El consumo de energía por pin permite 20 mA con un máximo de 40 mA y 200 mA en total. 
  * __En pocas palabras , creo que es más fácil usar Arduino si luego alguien más desea cambiar, ampliar o mejorar la solución actual.__

# Aplicación Android

El módulo Arduino se conecta a una aplicación de Android a través de bluetooth. La aplicación se puede descargar de forma gratuita desde [Google Play](https://play.google.com/store/apps/details?id=com.openweatherstation.app)

![OpenWeatherStation app](https://github.com/panchazo/open-weather-station/raw/master/docs/img/open_weather_station_app.jpg)

Algunas de las características principales de la aplicación OpenWeatherStation son:

  * conectarse al módulo OWS, ver y almacenar datos,
  * almacenar muestras hasta 60 días,
  * visualizar gráficos en tiempo real,
  * acceder a los datos históricos por intervalos de fecha y hora,
  * configurar hasta 2 servidores para cargar datos meteorológicos,
  * configurar APIs personalizadas para enviar los datos a un server propio o usar un servidor preconfigurado
  * servidores preconfigurados disponibles para WindGuru, Wunderground, Thingspeak y OpenWeatherMap
  * exportar datos almacenados a un archivo local (SQLite)
  * enviar archivo de datos exportados por correo electrónico
  * cambio automático de wifi a datos móviles si wifi no tiene internet

## Setup inicial de la app
Siga los siguientes pasos para comenzar (también hay un [video tutorial](https://www.youtube.com/watch?v=DoZqg74PRDg) para esto):

  * Una vez que descargas la aplicación, lo primero es vincularla con el bluetooth OWS. Vaya a "OWS Module" en el menú de la izquierda
  * Si no ha emparejado el bluetooth, haga clic en el icono de la esquina superior derecha para abrir la configuración de bluetooth y vincular el dispositivo
  * Una vez emparejados, vuelve a la aplicación y actualiza la lista de dispositivos.
  * De la lista de dispositivos, elija la que desea conectar y configúrela como el dispositivo OWS.
  * Puede inspeccionar los paquetes recibidos del módulo OWS abriendo el monitor de datos
  * Al enviar los datos a un servicio remoto, puede activar "Prevent LieFi" (debe tener habilitado Wifi y datos para esto)
    * Se usa para la situación en que la conexión WiFi funciona pero no tiene Internet, ya que en este caso Android no cambiará automáticamente a datos móviles, pero si habilitó "Prevent LieFi", la aplicación apagará WiFi y usará paquetes de datos móviles hasta que Internet por WiFi haya regresado y luego continuará usando WiFi... sí, lo sé ... de nada =)
  * Todos los otros ajustes son bastante auto explicativos

Si está utilizando el dispositivo Android para la telemetría, es posible que desee rootear su dispositivo y también instalar la aplicación Remote Reboot ( https://play.google.com/store/apps/details?id=ar.com.axones.remotereboot ) . Esta aplicación actuará como un watchdog que le permite reiniciar Android de forma remota a través de SMS o utilizando un endpoint (URL). 

## Conectando a otros dispositivos
Dado que el módulo Arduino transmite los datos cada minuto, puede crear su propia solución que se conecte a través de Bluetooth y procesar los datos como desee en lugar de utilizar la aplicación de Android propuesta. Por ejemplo, una implementación de Raspberry podría ser una gran alternativa para lograr esto, o podría escribir una aplicación de Windows 10 y conectarse al módulo con su computadora, solo por mencionar algunos ejemplos. Sin embargo, estas alternativas están fuera del alcance del proyecto actual por el momento.

# Armado del módulo Arduino
A continuación, presento una guía paso a paso para que pueda construir su propio módulo.

![OWS assembly](https://github.com/panchazo/open-weather-station/raw/master/docs/img/assembly_teaser.jpg)

## Tutoriales de Youtube
Además de esta guía armé una serie de videos de referencia para que quede más claro cómo construir la estación de 0 a 100%:

 * [Parte 1, 3min - Preparación del PCB (método de toner transfer)](https://www.youtube.com/watch?v=28tQO9Scug0)
 * [Parte 2, 5min - Soldando los componentes](https://www.youtube.com/watch?v=fOKPI9sTK5E)
 * [Parte 3, 5min - Conectando sensores y cargando el arduino](https://www.youtube.com/watch?v=DoZqg74PRDg)
 * [Parte 4, 4min - Preparación para exteriores](https://www.youtube.com/watch?v=TYDTiXwKLVI)
__Los videos tienen subtítulos tanto en castellano como inglés.__ 
 
## Diagrama esquemático

![OWS schematics](https://github.com/panchazo/open-weather-station/raw/master/docs/img/circuit_diagram.png)

## Lista de materiales
La siguiente es la lista completa de los materiales necesarios para implementar la estación con todas sus características. En las siguientes secciones enseñaré cómo ensamblar el módulo arduino OWS teniendo en cuenta el escenario ideal con todos los componentes, sin embargo, el módulo seguirá funcionando si no conecta todos los sensores, por lo tanto, si solo quiere medir la velocidad del viento, por ejemplo simplemente puede ignorar los sensores de lluvia, luz o presión.


| Item                                                                                                                                | Cantidad | Uso                                   |
|-------------------------------------------------------------------------------------------------------------------------------------|----------|---------------------------------------|
| Led rojo o verde                                                                                                                    | 1        | luz de status                          |
| 18 kOhm resistor                                                                                                                    | 2        | circuito antirrebote |
| 12 kOhm resistor                                                                                                                    | 2        | circuito antirrebote  |
| 10 kOhm resistor                                                                                                                    | 1        | veleta                              |
| 220 Ohm resistor                                                                                                                    | 1        | led de status                            |
| 2.2 kOhm resistor                                                                                                                   | 1        | bluetooth                             |
| 1 kOhm resistor                                                                                                                     | 2        | bluetooth                             |
| rj11 jack doble [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/rj11_socket.jpg)                                                                                                                     | 1        | conexión de anemómetro, veleta y pluviómetro |
| diode                                                                                                                               | 2        | circuito antirrebote  |
| 1μF capacitor                                                                                                                        | 2        | circuito antirrebote  |
| NPN transistor                                                                                                                      | 1        | bluetooth                             |
| PCB de cobre de un solo lado de 5 cm x 7 cm o más grande [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/pcb_single_side_copper.jpg)                                                                                          | 1        | pcb para conectar los componentes      |
| Arduino Uno R3 y su cable USB                                                                                                                     | 1        | unidad de procesamiento                        |
| BH1750 sensor de luz                                                                                                                | 1        | luz                                |
| BME280 sensor presión, temperatura y humedad                                                                                       | 1        | presión, temperatura y humedad       |
| HC05 módulo Bluetooth                                                                                                                | 1        | bluetooth               |
| Anemómetro de repuesto WS 1080  [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/ws1080_anemometer.jpg)                                                                                              | 1        | viento y rachas
| Veleta de repuesto WS 1080  [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/ws1080_windvane.jpg)                                                                                               | 1        | dirección de viento                  |
| Pluviómetro de repuesto WS 1080 [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/ws1080_rain_gauge.jpg)                                                                                               | 1        | lluvia                                  |
| Conectores macho (male header pins pack) [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/header_pins.jpg)                                                                                                           | 1        | conectorizado de cables
| Conectores hembra (female header pins pack) [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/female_header_pins.jpg)                                                                                                           | 1        | conectorizado de bluetooth |
| Cables hembra-hembra (jumper wires pack) [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/female_female_jumper_wires.jpg)                                                                                                 | 1        | cableado de sensores
| Batería portátil de 5000mAh (power bank) __que funcione sin necesidad de tocar un botón para que se encienda__ | 1        | alimentación de arduino          |
| Caja estanca para exteriores de 15x10x10cm o similar                                                                                      | 1        | alojar los componentes  |
| Cargador de pared USB doble 110/220v  [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/dual_usb_wall_socket_charger_module.jpg)                                                                                       | 1        | Alimentación general                  |
| Cable 110v/220v  [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/110-220_power_cable.jpg)                                                                                                              | 1        | alimentación                                 |
| Soporte plástico para anemómetro y veleta de repuesto para WS 1080 [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/ws1080_anemometer_windvane_support.jpg)                                                                                                                    | 1        | soporte de sensores |
| Soporte plástico de pluviómetro de repuesto para WS 1080 [(example)](https://github.com/panchazo/open-weather-station/raw/master/docs/img/ws1080_rain_gauge_support.jpg)                                                                                                                   | 1        | soporte de sensores
***
**Recuerde que he incluido todos los componentes necesarios para un ensamblaje de módulo OWS Arduino completo, puede comprar solo los relacionados con los sensores que desea implementar o incluso crear uno propio si desea reducir algunos costos (como los soportes de plástico para viento y lluvia). La implementación del código Arduino seguirá funcionando si solo se conectan algunos sensores.**
***

## Soldadura y cableado
Tengo una detallada galería de imágenes paso a paso en la que puede usar una referencia para producir el módulo de OWS:

* [Galería de fotos paso a paso](https://github.com/panchazo/open-weather-station/raw/master/docs/img/assembly-step-by-step/)

Explicaré también cómo ensamblar y organizar los componentes como referencia para que pueda comenzar a construir su propia estación en las siguientes secciones.

### Grabado de PCB

Existen varias técnicas para producir el circuito de la placa, desde dibujar manualmente el circuito con un marcador permanente hasta un método llamado __toner transfer__ ( https://www.youtube.com/watch?v=QQupRXEqOz4 ). Como hay muchos videos y tutoriales sobre cómo hacerlo, le dejaré elegir el método que prefiera. En caso de que elija el método de toner transfer, recuerde que es muy importante utilizar un papel glossy de calidad fotográfica.

En cualquier caso, puede utilizar [esta hoja PDF](https://github.com/panchazo/open-weather-station/raw/master/docs/pcb%20printing%20sheet.pdf) o utilizar la siguiente imagen de circuito de cobre para hacer el pcb. Ambos tienen una referencia de tamaño en el lado izquierdo (50 mm) que puede usar para asegurarse de que la impresora no modificó sus dimensiones originales y recuerde también que el circuito ya se ha reflejado para que quede al derecho una vez impreso el circuito.

![OWS pcb](https://github.com/panchazo/open-weather-station/raw/master/docs/img/pcb_copper_mirror.png)

* [Grabado y perforado](https://github.com/panchazo/open-weather-station/tree/master/docs/img/assembly-step-by-step/1%20-%20Etching%20and%20drilling)

### Perforando el PCB

Una vez que tenga el circuito listo, perfore los agujeros (utilizo un taladro de 1 mm). A partir del diagrama y del diseño del circuito, los agujeros requeridos son autoexplicativos:

![OWS pcb drilling](https://github.com/panchazo/open-weather-station/raw/master/docs/img/pcb_drilling.jpg)


### Soldando componentes
Use el siguiente diagrama y la lista de componentes para soldar cada elemento al circuito. Hay dos cosas a tener en cuenta:

  * Los "cuadrados" en cada lado del diagrama de la placa con los códigos __D2, D3, D9, D10, D12, D13, A5, A4, A2, GND y VCC__ deben conectarse a los pines Arduino Uno correspondientes, por lo tanto, preste mucha atención al soldar los pines macho hacia abajo y al conectar la placa al Arduino.

  * __bht, bmp, stat, veleta, anem y pluv__ son pines macho que se supone que están boca arriba (el lado opuesto se conecta con arduino) para luego cablear los sensores. De esta manera puede reemplazar cualquier elemento y organizar los componentes en la carcasa mucho más fácil.

 * el __blue__ es un pin hembra para luego conectar el HC05, los círculos rojos indican que no se necesita conexión en esos pines, por lo que la soldadura es opcional

* preste mucha atención a la polaridad de los capacitores y a la dirección de los diodos como se indica en el diagrama. En las imágenes soldé estos en la parte superior así es más fácil mostrar cómo lo hice, pero sería mejor soldarlos en el lado opuesto (como hice en los videos) para que se vea mejor la placa terminada.

* [Soldando los pines](https://github.com/panchazo/open-weather-station/tree/master/docs/img/assembly-step-by-step/2%20-%20PCB%20header%20pins)

 * Puede terminar el circuito de PCB __después de que todo esté en su lugar y probado__ con una pequeña capa de esmalte de uñas transparente (barniz) para proteger los contactos expuestos a fin de reducir la oxidación.

![OWS pcb](https://github.com/panchazo/open-weather-station/raw/master/docs/img/pcb-components.png)

| Item              | código        |
|-------------------|---------------|
| 18 kOhm resistor  | R6, R2        |
| 12 kOhm resistor  | R8, R4        |
| 10 kOhm resistor  | R9            |
| 220 Ohm resistor  | R10           |
| 2.2 kOhm resistor | R11           |
| 1 kOhm resistor   | R12, R13      |
| 1μF capacitor electrolitico   | C1, C2 |
| diodo             | D1, D2        |
| Transistor NPN    | NPN           |
| conectores macho para conectar al arduino (soldar hacia abajo)       | D2, D3, D9, D10, D12, D13, A2, A4, A5, GND, VCC        |
| conectores macho para los sensores (soldar hacia arriba)       | anem, pluv, stat, bmp, bht, vane |
| conectores hembra para el bluetooth (soldar hacia arriba)       | blue |

* [Soldando componentes](https://github.com/panchazo/open-weather-station/tree/master/docs/img/assembly-step-by-step/3%20-%20Soldering%20components)

# Cableado y conexión de sensores
Una vez que haya soldado todos los elementos, es hora de conectarse a los sensores.

* [Cableado de sensores](https://github.com/panchazo/open-weather-station/tree/master/docs/img/assembly-step-by-step/5%20-%20Wire%20sensors%20and%20power)

## Velocidad del viento, dirección del viento y lluvia
Estos sensores, que son piezas de repuesto para la estación meteorológica WS1080, usan una línea telefónica (RJ11) que conectaremos con el módulo Arduino utilizando un jack (conector hembra) RJ11 dual.

El anemómetro y la veleta usan un conector RJ11 donde los 2 pines centrales (cables rojo y verde) conectan el anemómetro y los 2 externos (negro y amarillo) pertenecen a la veleta. El pluviómetro utiliza sus pines centrales RJ11 (rojo y verde) para conectarse al sensor.

Para conectar la toma RJ11 al módulo arduino, utilice los cables hembra (corte una de las puntas para dejar el cable expuesto) como se ilustra en las imágenes de galería paso a paso.

* [Cableando el jack RJ11](https://github.com/panchazo/open-weather-station/tree/master/docs/img/assembly-step-by-step/4%20-%20Wiring%20RJ11%20Jack)

## Presión, temperatura y humedad
These three parameters are obtained using the BME280, beware that there are many places selling the BMP280 as if it was the BME, but the BMP will NOT measure humidity so pay close attention to the chip specs before buying. 

Conecte el chip BME usando los cables hembra-hembra al pin macho del conector "bme" en la placa.

## Light
La cantidad de luz medida en lux se obtiene usando el sensor BH1750. Conecte el chip usando los cables al pin macho "bht" en la placa.


## Bluetooth
El módulo arduino, como se explicó anteriormente, envía los datos usando el módulo Bluetooth HC05. Para conectarlo a la placa, simplemente conecte el HC05 a los pines hembra "blue" como se muestra en la galería.

## Les de status
El led de estado es solo un led rojo o verde que parpadea para indicar que la estación está funcionando. Por lo tanto, recomiendo colocar el led donde sea visible. Cablee el led al pin del conector macho en la placa "stat" (recuerde conectar la pata más corta del led al pin de la placa que está conectado a tierra).

# Alimentando el módulo arduino
Para alimentar el módulo, conecte el cable USB del Arduino Uno al banco de alimentación portátil y el banco de alimentación a una de las 2 salidas USB disponibles en el cargador de pared 110/220v, la salida restante se puede usar más adelante para conectar el cable USB del teléfono. Si no desea utilizar un banco de energía para mantener el módulo encendido en caso de pérdida de potencia, simplemente puede enchufar el cable usb arduino directamente al módulo de tomacorriente de pared. __El banco de potencia debe cumplir con las siguientes características:__

  * debe tener un consumo de energía que el cargador puede suministrar, por lo que si compra uno que necesita una entrada de 2 A (2000 mA), utilice un cargador que tenga al menos esa potencia de salida
  * el banco de energía DEBE funcionar sin intervención del usuario una vez que se haya enchufado, ya que si se apaga la electricidad no habrá nadie para presionar ningún botón para encenderlo
  * por último, tiene que ser capaz de alimentar el dispositivo MIENTRAS lo carga al mismo tiempo, algunos bancos de potencia no generarán potencia mientras se está cargando

El cargador USB de pared se conecta a 110 / 220v para alimentar el módulo. Recomiendo cablearlo con el cable de alimentación de 110/220 V, por lo que es más fácil conectarlo a cualquier toma de corriente. También puede lograr lo mismo con un cargador de pared USB normal, pero asegúrese de protegerlo dentro de la carcasa, ya que normalmente los cargadores no funcionan bien expuestos al aire libre durante un largo período de tiempo. 

* [Alimentación del módulo](https://github.com/panchazo/open-weather-station/tree/master/docs/img/assembly-step-by-step/5%20-%20Wire%20sensors%20and%20power)

# Recomendaciones para exteriores
Las imágenes de galería paso a paso ilustran cómo organizo el módulo y todos los elementos dentro de la carcasa de plástico, aunque esto es solo una referencia. Solo tenga en cuenta que necesita proteger todos los componentes electrónicos de los elementos (como fuertes vientos, granizadas, lluvia, etc.). La luz solar es muy dañina para los plásticos que no están protegidos contra los rayos UV así que intente usar materiales que estén preparados para ser usados al aire libre.

Algunos prefieren usar la pantalla de Stevenson para este propósito ( https://en.wikipedia.org/wiki/Stevenson_screen ).

El BME280 debe estar expuesto (pero protegido) para medir adecuadamente la temperatura, la presión y la humedad, por lo que no es aconsejable encerrarlo en una caja sellada (al igual que el BH1750 para medir la luz). También tenga en cuenta el calor que el sol directo producirá en la carcasa y en los sensores, ya que puede elevar mucho la temperatura de los componentes electrónicos. He probado las estaciones expuestas al sol directo durante varios días con una temperatura interna de la carcasa de 60ºC sin problemas.

* [Protección para exteriores](https://github.com/panchazo/open-weather-station/tree/master/docs/img/assembly-step-by-step/8%20-%20Final%20preparation%20and%20housing)

# Cargar el código al arduino
Primero, hay que cargar el programa arduino. Dentro de la carpeta del proyecto "arduino" encontrará otra carpeta llamada "open weather station" donde se encuentra el archivo del programa .ino. Además, dentro de la carpeta "arduino" he colocado las bibliotecas que necesitará para los sensores específicos, incluya esas bibliotecas en su proyecto arduino ( https://www.arduino.cc/en/Guide/Libraries ) y debería ser listo para compilar.

Hice todo lo posible para organizar, agregar comentarios al código y mantener el código simple para que sea comprensible, así que lea el código para obtener más información sobre cómo funciona. Igualmente déjame darte algunos consejos básicos.

## Acerca de las constantes del programa arduino

  * __ENABLE_DEBUG_SERIAL_OUTPUT__: si es verdadero, emitirá datos de depuración por el monitor serie. Recomiendo usarlo al principio para saber si funciona correctamente y los sensores están adquiriendo datos. Puedes apagarlo para producción.

  * __ARDUINO_AUTOREBOOT_MINUTES__:  una vez que transcurre la cantidad de minutos definidos en esta constante, el arduino se reiniciará automáticamente y reiniciará el chip bluetooth (se apagará y se encenderá nuevamente). Este temporizador puede reiniciarse enviando un comando al módulo.

  * __Parámetros de calibración__:  el módulo realizará el cálculo internamente y enviará la velocidad del viento y la lluvia en función de los parámetros de calibración predeterminados que puede manipular cambiando las siguientes constantes:

    * __ANEMOMETER_SPEED_FACTOR__, factor de anemómetro de copa, si no conoce este valor, déjelo como está
    * __ANEMOMETER_CIRCUMFERENCE_MTS__, la circunferencia de un ciclo completo calculado desde el punto central de la copa
    * __ANEMOMETER_CYCLES_PER_LOOP__, cuántos "recuentos" genera el anemómetro en un ciclo completo, normalmente es 2, pero podría ser 1 según el sensor
    * __RAIN_BUCKET_MM_PER_CYCLE__, cuántos milímetros de lluvia son equivalentes para cada conteo del sensor
    * __VANE_AD...__,  la veleta tiene un conjunto de resistencias que varían según la dirección del viento, arduino envía 5v a través del sensor y realizará una conversión de analógico a digital (A / D) del valor que va de 0 a 1023 y dependiendo de la orientación de la paleta, el valor A / D cambiará. Por lo tanto, los valores __VANE_AD...__ son el número coincidente para cada una de las direcciones y están calibrados para la veleta de repuesto de la estación WS1080. Cuando se adquiere el valor A / D, se utiliza el valor __VANE_AD...___ más próximo que corresponde para asignar la dirección del viento.

El resto de las constantes son auto explicativas.

## Muestras de datos parciales y completos
El módulo enviará por defecto cada 5 segundos las muestras de viento parciales, útiles por ejemplo para mostrar más datos de viento en "tiempo real", y luego, cada minuto, el módulo envía todos los datos con las muestras de viento promediadas, ráfagas, temperatura, etc. Las muestras parciales se envían desde la función "sendWindPartialSample" y las muestras completas se envían desde la función "sendFullSamples". Cada dato del sensor está separado por un separador (configurado en las constantes) y cada transmisión termina con una nueva línea. Eche un vistazo a esas funciones en el código arduino para comprender cómo se etiquetan y envían las muestras. Recomiendo encarecidamente activar la constante de salida de depuración __ENABLE_DEBUG_SERIAL_OUTPUT__ para que pueda ver los datos en el monitor del IDE de Arduino, de lo contrario tendrá que conectarse por Bluetooth para ver los datos.

## Conexión bluetooth al módulo OWS 
Para conectarse al módulo hay varias alternativas. No entraré en detalles sobre cómo emparejar y conectar un dispositivo bluetooth desde su PC, Mac, computadora portátil, dispositivo Iphone o Android, ya que hay muchos tutoriales que explican eso con mayor detalle (sin embargo, en la galería paso a paso muestro algunas imágenes donde me conecto usando mi PC y teléfono Android).

Solo tenga en cuenta que el dispositivo bluetooth que está utilizando para el módulo Arduino OWS aparecerá como HC05 al ser descubierto y, si se solicita un código para vincularlo al dispositivo, el HC05 generalmente usa 1234 o 0000. Si está probando con una app desde un celular (ej. https://play.google.com/store/apps/details?id=project.bluetoothterminal ) por ejemplo o incluso a través de Putty a su computadora portátil usando un puerto COM bluetooth ( http://www.instructables.com) / id / Remote-Control-Bluetooth-Arduino-PuTTY / ), verá en su pantalla los mismos datos que ve en el monitor serie Arduino IDE (siempre que el indicador de salida de depuración esté configurado en verdadero).


* [Conexión y prueba](https://github.com/panchazo/open-weather-station/tree/master/docs/img/assembly-step-by-step/7%20-%20connect%20via%20android)

### Envío de comandos al módulo OWS
Puede enviar comandos (un carácter ascii en mayúscula) para que el módulo haga algunas cosas. En el sketch Arduino provisto la función "readCmdFromBluetooth" implementa esta característica. Por ejemplo, permite:

* letra __R__: reinicia el arduino
* letra __T__: restablece el temporizador que hará que el arduino se reinicie cada ARDUINO_AUTOREBOOT_MINUTES
* letra __S__: permite que el módulo envíe las muestras parciales
* letra __Q__: deshabilita el módulo para enviar las muestras parciales y solo enviará las muestras completas cada minuto
* letra __L__: envíe todas las medidas almacenadas para los últimos WIND_AVG_MINUTE_LOG_SIZE minutos (recuerde que este registro se borra después de reiniciar el módulo y puede haber sido inicializado a cero durante el reinicio)

# Autor
* **Ing. Francisco Clariá** - https://ar.linkedin.com/in/franciscosc
