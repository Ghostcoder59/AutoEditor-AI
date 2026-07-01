import os
from tensorflow import keras
try:
    import tensorflowjs as tfjs
except Exception as e:
    print('tensorflowjs import failed:', e)
    raise

model_h5 = os.path.join(os.path.dirname(__file__), 'output_tfjs', 'model.h5')
out_dir = os.path.join(os.path.dirname(__file__), 'output_tfjs', 'tfjs_model')

print('Loading model from', model_h5)
model = keras.models.load_model(model_h5)
print('Converting to TF.js format into', out_dir)
os.makedirs(out_dir, exist_ok=True)
tfjs.converters.save_keras_model(model, out_dir)
print('Conversion complete.')
