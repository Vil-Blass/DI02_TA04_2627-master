import { Component, signal, computed, inject, ElementRef, ViewChild } from '@angular/core';
import { IonicModule, AlertController, ModalController, ToastController, LoadingController } from '@ionic/angular';
import { Restaurante } from '../interface/restaurante';
import { RestauranteService } from '../services/restaurante.service';
import { AddRestauranteModalComponent } from '../components/add-restaurante-modal/add-restaurante-modal.component';
import restaurantesJSON from '../../assets/datos/restaurantes.json';

type ColumnaOrdenable = 'documentName' | 'locality' | 'territory' | 'michelinStar' | 'repsolSun';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonicModule],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage {

  // ############################### REGION DATOS ###############################

  // CAMBIO: DEFINE LOS DOCUMENTOS PDF QUE SE PUEDEN ABRIR DESDE EL SELECTOR.
  readonly pdfs = [
    { nombre: 'Mejoras de usabilidad', url: 'assets/pdfs/Chat_mejoras_usabilidad.pdf' },
    { nombre: 'Chat', url: 'assets/pdfs/Chat.pdf' },
    { nombre: 'Guía de proyecto', url: 'assets/pdfs/guia-proyecto-restaurantes.pdf ' },
    
  ];
  video = 'assets/videos/cambios-explicados.mp4';
  videoAbierto = signal(false);

  @ViewChild('videoPlayer') private videoPlayer?: ElementRef<HTMLVideoElement>;

  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private modalCtrl = inject(ModalController);
  private restauranteService = inject(RestauranteService);

  // Restaurantes leídos del JSON local (usados para la importación a Firebase)
  restaurantes: Restaurante[] = restaurantesJSON as Restaurante[];

  // Signal principal con los restaurantes actualmente cargados (vacío hasta que el usuario pulsa "Cargar datos")
  restaurantesCargados = signal<Restaurante[]>([]);

  // true durante la carga de datos
  cargando = signal(false);

  // true durante la importación del JSON a Firebase
  importando = signal(false);

  // CAMBIO: INDICA CUANDO SE ESTÁ BORRANDO UN RESTAURANTE.
  borrando = signal(false);

  // CAMBIO: GUARDA LA COLUMNA Y DIRECCIÓN DE ORDENACIÓN ELEGIDAS.
  sortColumna = signal<ColumnaOrdenable>('documentName');
  sortDireccion = signal<'asc' | 'desc'>('asc');

  // CAMBIO: TEXTO VISIBLE MIENTRAS SE CARGAN RESTAURANTES DESDE FIREBASE.
  estadoCarga = computed(() => this.cargando() ? 'Cargando restaurantes...' : '');

  // true cuando hay al menos un restaurante cargado
  hayDatos = computed(() => this.restaurantesCargados().length > 0);

  cerrarVideo() {
    this.videoPlayer?.nativeElement.pause();
    this.videoAbierto.set(false);
  }

  // Carga los restaurantes desde Firebase y muestra un toast de confirmación
  async cargarDatos() {
    // CAMBIO: EVITA INICIAR OTRA OPERACIÓN MIENTRAS HAYA UNA ACTIVA.
    if (this.cargando() || this.importando() || this.borrando()) return;

    this.cargando.set(true);
    try {
      const datos = await this.restauranteService.getAll();
      this.restaurantesCargados.set(datos);
      this.mostrarToast(`${datos.length} restaurantes cargados`, 'success');
    } catch (error) {
      // CAMBIO: REGISTRA EL ERROR PARA FACILITAR SU DIAGNÓSTICO.
      console.error('Error al cargar restaurantes desde Firebase:', error);
      this.mostrarToast(this.esErrorPermiso(error)
        ? 'Sin permisos en Firebase. Revisa las reglas de seguridad.'
        : 'Error al cargar datos. Revisa tu conexión a internet.', 'danger');
    } finally {
      this.cargando.set(false);
    }
  }

  // Muestra un diálogo de confirmación antes de iniciar la importación
  async confirmarImportacion() {
    // CAMBIO: EVITA ABRIR LA CONFIRMACIÓN DURANTE OTRA OPERACIÓN.
    if (this.cargando() || this.importando() || this.borrando()) return;

    const alert = await this.alertCtrl.create({
      header: 'Confirmar importación',
      subHeader: `Se importarán ${this.restaurantes.length} restaurantes`,
      message: 'Los datos actuales de Firebase serán borrados y reemplazados con los del archivo local. ¿Deseas continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Sí, importar', role: 'confirm', handler: () => this.importarJSON() }
      ]
    });
    await alert.present();
  }

  // Borra todos los datos de Firebase y sube los restaurantes del JSON local
  async importarJSON() {
    // CAMBIO: EVITA IMPORTACIONES O ACCIONES SIMULTÁNEAS.
    if (this.cargando() || this.importando() || this.borrando()) return;

    this.importando.set(true);
    let loading: HTMLIonLoadingElement | undefined;
    try {
      // CAMBIO: MUESTRA UN OVERLAY BLOQUEANTE Y ACTUALIZA SU MENSAJE POR FASE.
      loading = await this.loadingCtrl.create({
        message: 'Borrando datos...',
        backdropDismiss: false
      });
      await loading.present();
      await this.restauranteService.deleteAll();
      loading.message = 'Subiendo restaurantes...';
      await this.restauranteService.addAll(this.restaurantes);
      await loading.dismiss();
      loading = undefined;
      this.mostrarToast(`${this.restaurantes.length} restaurantes importados correctamente`, 'success');
    } catch (error: unknown) {
      if (loading) await loading.dismiss();
      // CAMBIO: MANTIENE EL DETALLE DEL ERROR EN LA CONSOLA Y AVISA AL USUARIO.
      console.error('Error al importar JSON:', error);
      const msg = this.esErrorPermiso(error)
        ? 'Sin permisos en Firebase. Revisa las reglas de seguridad.'
        : 'Error al importar. Revisa tu conexión a internet.';
      this.mostrarToast(msg, 'danger');
    } finally {
      this.importando.set(false);
    }
  }

  // Muestra confirmación y borra el restaurante indicado de Firebase y de la lista local
  async borrarRestaurante(r: Restaurante) {
    // CAMBIO: EVITA INICIAR EL BORRADO DURANTE OTRA OPERACIÓN.
    if (this.cargando() || this.importando() || this.borrando()) return;

    const alert = await this.alertCtrl.create({
      header: 'Confirmar borrado',
      subHeader: `¿Deseas borrar el restaurante ${r.documentName}?`,
      message: `Este proceso es irreversible`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Borrar', role: 'confirm', cssClass: 'danger',
          handler: async () => {
            if (!r.id) {
              this.mostrarToast('No se puede borrar: el restaurante no tiene ID.', 'danger');
              return;
            }
            if (this.cargando() || this.importando() || this.borrando()) return;

            this.borrando.set(true);
            try {
              // CAMBIO: MUESTRA EL OVERLAY DURANTE EL BORRADO Y LO CIERRA AUNQUE HAYA ERROR.
              let loading: HTMLIonLoadingElement | undefined;
              try {
                loading = await this.loadingCtrl.create({
                  message: 'Borrando restaurante...',
                  backdropDismiss: false
                });
                await loading.present();
                await this.restauranteService.delete(r.id);
                this.restaurantesCargados.update(lista => lista.filter(x => x.id !== r.id));
              } finally {
                if (loading) await loading.dismiss();
              }
              await this.mostrarToastConDeshacer(r);
            } catch (error) {
              // CAMBIO: REGISTRA EL ERROR Y MUESTRA UN AVISO PERSISTENTE.
              console.error(`Error al borrar el restaurante ${r.documentName}:`, error);
              this.mostrarToast(this.esErrorPermiso(error)
                ? 'Sin permisos para borrar en Firebase. Revisa las reglas de seguridad.'
                : 'Error al borrar el restaurante. Revisa tu conexión.', 'danger');
            } finally {
              this.borrando.set(false);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Abre el modal para añadir un restaurante nuevo
  async abrirModalAnadir() {
    // CAMBIO: IMPIDE ABRIR EL FORMULARIO DURANTE OTRA OPERACIÓN DE FIREBASE.
    if (this.cargando() || this.importando() || this.borrando()) return;

    const modal = await this.modalCtrl.create({
      component: AddRestauranteModalComponent,
      cssClass: 'restaurant-form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      await this.cargarDatos();
    }
  }

  // Muestra un toast con el mensaje y color indicados
  private async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      // CAMBIO: LOS ERRORES SON PERSISTENTES Y LOS AVISOS DE ÉXITO DURAN 3 SEGUNDOS.
      duration: color === 'success' ? 3000 : 0,
      color,
      position: 'bottom',
      buttons: [{ text: 'cerrar', role: 'cancel' }]
    });
    await toast.present();
  }

  // CAMBIO: PERMITE RECUPERAR UN RESTAURANTE DURANTE 6 SEGUNDOS TRAS BORRARLO.
  private async mostrarToastConDeshacer(restaurante: Restaurante) {
    const toast = await this.toastCtrl.create({
      message: `${restaurante.documentName} eliminado`,
      duration: 6000,
      color: 'success',
      position: 'bottom',
      buttons: [
        {
          text: 'Deshacer',
          handler: () => {
            void this.deshacerBorrado(restaurante);
          }
        },
        { text: 'Cerrar', role: 'cancel' }
      ]
    });
    await toast.present();
  }

  // CAMBIO: RESTAURA EL DOCUMENTO BORRADO Y NOTIFICA SI FALLA.
  private async deshacerBorrado(restaurante: Restaurante) {
    if (this.cargando() || this.importando() || this.borrando()) {
      this.mostrarToast('No se puede deshacer mientras hay otra operación en curso.', 'danger');
      return;
    }

    this.borrando.set(true);
    let loading: HTMLIonLoadingElement | undefined;
    try {
      loading = await this.loadingCtrl.create({
        message: 'Restaurando restaurante...',
        backdropDismiss: false
      });
      await loading.present();
      await this.restauranteService.restore(restaurante);
      this.restaurantesCargados.update(lista =>
        lista.some(item => item.id === restaurante.id) ? lista : [...lista, restaurante]
      );
      await loading.dismiss();
      loading = undefined;
      this.mostrarToast(`${restaurante.documentName} restaurado`, 'success');
    } catch (error) {
      if (loading) await loading.dismiss();
      console.error(`Error al deshacer el borrado de ${restaurante.documentName}:`, error);
      this.mostrarToast(this.esErrorPermiso(error)
        ? 'Sin permisos para restaurar en Firebase. Revisa las reglas de seguridad.'
        : 'Error al deshacer el borrado. Revisa tu conexión.', 'danger');
    } finally {
      this.borrando.set(false);
    }
  }

  private esErrorPermiso(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error &&
      error.code === 'permission-denied';
  }


  // ############################### REGION FILTROS (estado general) ###############################

  textoBusqueda = signal('');

  // true si hay algún filtro activo (texto, territorio o localidades)
  hayFiltrosActivos = computed(() =>
    !!this.textoBusqueda() ||
    !!this.territorioSeleccionado() ||
    this.localidadesSeleccionadas().length > 0
  );

  // Resetea todos los filtros a sus valores iniciales
  limpiarTodosFiltros() {
    this.textoBusqueda.set('');
    this.territorioSeleccionado.set('');
    this.localidadesSeleccionadas.set([]);
  }

  // CAMBIO: ELIMINA CADA FILTRO DESDE SU CHIP O CONTROL INDIVIDUAL.
  eliminarTextoBusqueda() {
    this.textoBusqueda.set('');
  }

  eliminarTerritorio() {
    if (this.localidadesSeleccionadas().length > 0) return;
    this.territorioSeleccionado.set('');
  }

  eliminarLocalidad(localidad: string) {
    this.localidadesSeleccionadas.update(localidades =>
      localidades.filter(item => item !== localidad)
    );
  }

  limpiarLocalidades() {
    this.localidadesSeleccionadas.set([]);
  }

  // ############################### REGION TERRITORIOS ###############################

  territorioSeleccionado = signal('');

  // Lista de territorios únicos disponibles, ordenada alfabéticamente
  territoriosFiltrados = computed(() => {
    const territorios = this.restaurantesCargados().map(r => r.territory);
    return Array.from(new Set(territorios)).sort();
  });

  // Actualiza el territorio seleccionado y elimina las localidades que ya no pertenecen a él
  onTerritorioChange(value: string) {
    this.territorioSeleccionado.set(value);
    const nuevasLocalidades = this.localidadesSeleccionadas().filter(loc =>
      this.localidadesFiltradasPorTerritorio().includes(loc)
    );
    this.localidadesSeleccionadas.set(nuevasLocalidades);
  }

  // ############################### REGION LOCALIDADES ###############################

  localidadesSeleccionadas = signal<string[]>([]);

  // Lista de localidades únicas del territorio seleccionado (o de todos si no hay territorio), ordenada alfabéticamente
  localidadesFiltradasPorTerritorio = computed(() => {
    let lista = this.restaurantesCargados();
    const territorio = this.territorioSeleccionado().toLowerCase().trim();
    if (territorio) {
      lista = lista.filter(r => r.territory?.toLowerCase().trim() === territorio);
    }
    const localities = lista.map(r => r.locality?.trim()).filter((l): l is string => !!l);
    return Array.from(new Set(localities)).sort();
  });

  // Actualiza las localidades seleccionadas con los valores del evento
  onLocalidadesChange(value: string[]) {
    this.localidadesSeleccionadas.set(value);
  }

  // ############################### REGION RESULTADOS ###############################

  // Lista filtrada de restaurantes según todos los filtros activos
  restaurantesFiltrados = computed(() => {
    let lista = this.restaurantesCargados();

    const texto = this.textoBusqueda().toLowerCase().trim();
    if (texto) {
      lista = lista.filter(r => r.documentName.toLowerCase().includes(texto));
    }

    const territorio = this.territorioSeleccionado().toLowerCase().trim();
    if (territorio) {
      lista = lista.filter(r => r.territory?.toLowerCase().trim() === territorio);
    }

    const seleccionadas = this.localidadesSeleccionadas();
    if (seleccionadas.length > 0) {
      lista = lista.filter(r => seleccionadas.includes(r.locality?.trim() || ''));
    }

    const columna = this.sortColumna();
    const direccion = this.sortDireccion() === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      const valorA = this.valorOrden(a, columna);
      const valorB = this.valorOrden(b, columna);
      if (typeof valorA === 'number' && typeof valorB === 'number') {
        return (valorA - valorB) * direccion;
      }
      return String(valorA).localeCompare(String(valorB), 'es', { sensitivity: 'base' }) * direccion;
    });
  });

  // CAMBIO: ORDENA AL PULSAR UNA COLUMNA Y ALTERNA SU SENTIDO AL REPETIR.
  cambiarOrden(columna: ColumnaOrdenable) {
    if (this.sortColumna() === columna) {
      this.sortDireccion.update(direccion => direccion === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumna.set(columna);
      this.sortDireccion.set('asc');
    }
  }

  iconoOrden(columna: ColumnaOrdenable): string {
    if (this.sortColumna() !== columna) return 'swap-vertical-outline';
    return this.sortDireccion() === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline';
  }

  private valorOrden(restaurante: Restaurante, columna: ColumnaOrdenable): string | number {
    if (columna === 'michelinStar') return this.estrellasMichelin(restaurante);
    if (columna === 'repsolSun') return this.repsolSoles(restaurante);
    return restaurante[columna] ?? '';
  }

  // ############################### REGION AUXILIARES ###############################

  // Devuelve el número de estrellas Michelin (0 si no tiene o el valor no es numérico)
  estrellasMichelin(r: Restaurante): number {
    return Number(r.michelinStar) || 0;
  }

  // Devuelve el número de soles Repsol (0 si no tiene o el valor no es numérico)
  repsolSoles(r: Restaurante): number {
    return Number(r.repsolSun) || 0;
  }

  // CAMBIO: GENERA LOS ELEMENTOS VISUALES DE LAS ESTRELLAS Y SOLES.
  rangoPremios(cantidad: number): number[] {
    return Array.from({ length: Math.min(3, Math.max(0, Math.floor(cantidad))) }, (_, index) => index);
  }

  // CAMBIO: ABRE EN UNA PESTAÑA NUEVA EL PDF SELECCIONADO.
  verPDF(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
