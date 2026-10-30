import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { Restaurante } from '../../interface/restaurante';
import { RestauranteService } from '../../services/restaurante.service';

@Component({
  selector: 'app-add-restaurante-modal',
  standalone: true,
  imports: [IonicModule, ReactiveFormsModule],
  templateUrl: './add-restaurante-modal.component.html',
})
export class AddRestauranteModalComponent {

  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private restauranteService = inject(RestauranteService);

  guardando = signal(false);

  // CAMBIO: VALIDA QUE LOS PREMIOS SEAN NÚMEROS ENTEROS ENTRE 0 Y 3.
  form = this.fb.nonNullable.group({
    documentName: ['', [Validators.required, Validators.pattern(/\S/)]],
    territory:    ['', [Validators.required, Validators.pattern(/\S/)]],
    locality:     [''],
    address:      [''],
    phone:        [''],
    web:          [''],
    michelinStar: ['0', [Validators.required, Validators.min(0), Validators.max(3), Validators.pattern(/^[0-3]$/)]],
    repsolSun:    ['0', [Validators.required, Validators.min(0), Validators.max(3), Validators.pattern(/^[0-3]$/)]],
  });

  cancelar() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async guardar() {
    // CAMBIO: EVITA ENVIAR EL FORMULARIO MÁS DE UNA VEZ.
    if (this.guardando()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    try {
      const restaurante: Restaurante = {
        ...this.form.getRawValue(),
        documentDescription: '',
        templateType: '',
        localityQ: '',
        qualityQ: '',
        qualityIconDescription: '',
        accesibility: '',
        accesibilityIconDescription: '',
        marks: '',
        physical: '',
        visual: '',
        auditive: '',
        intellectual: '',
        organic: '',
        qualityAssurance: '',
        tourismEmail: '',
        importance: '',
        room: '',
        productClub: '',
        visit: '',
        capacity: '',
        store: '',
        gastronomical: '',
        surfing: '',
        postalCode: '',
        restorationType: '',
        recomended: '',
        recomendedURLIcon: '',
        recomendedIconDescription: '',
        restaurant: '',
        bodega: '',
        latitudelongitude: '',
        latwgs84: '',
        lonwgs84: '',
        placename: '',
        municipality: '',
        municipalitycode: '',
        postalcode: '',
        territorycode: '',
        country: '',
        countrycode: '',
        email: '',
        webpage: '',
        friendlyUrl: '',
        physicalUrl: '',
        dataXML: '',
        metadataXML: '',
        zipFile: '',
      };
      await this.restauranteService.add(restaurante);
      await this.modalCtrl.dismiss(restaurante, 'confirm');
    } catch (error) {
      // CAMBIO: REGISTRA EL ERROR Y MANTIENE EL AVISO VISIBLE HASTA CERRARLO.
      console.error('Error al guardar el restaurante en Firebase:', error);
      const esErrorPermiso = typeof error === 'object' && error !== null &&
        'code' in error && error.code === 'permission-denied';
      const toast = await this.toastCtrl.create({
        message: esErrorPermiso
          ? 'Sin permisos para guardar en Firebase. Revisa las reglas de seguridad.'
          : 'Error al guardar el restaurante. Revisa tu conexión a internet.',
        duration: 0,
        color: 'danger',
        position: 'bottom',
        buttons: [{ text: 'cerrar', role: 'cancel' }],
      });
      await toast.present();
    } finally {
      this.guardando.set(false);
    }
  }
}
